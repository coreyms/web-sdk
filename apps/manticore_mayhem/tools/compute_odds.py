"""Manticore Unleashed: feature trigger odds per mode, for the Armoury odds mock (2026-11-17).

Run (read only, writes nothing but stdout; --json <path> also writes the table as JSON):
  /Users/corey/Projects/stake-engine/math-sdk/env/bin/python -I compute_odds.py [--json <path>]

Repo copy (2026-11-17) of ~/Desktop/Manticore Mayhem/feedback/armoury_odds_mock_2026-11-17/compute_odds.py: its
figures are src/game/armouryOdds.ts (THE ARMOURY's odds rows and the rules' rate sentences read them).

What it reads (the published math, nothing else):
  math-sdk/games/manticore_mayhem/library/publish_files/index.json
  .../lookUpTable_<mode>_0.csv        id, weight, payoutMultiplier (cents of the base bet)
  .../books_<mode>.jsonl.zst          the books; a book's feature is its bonusStart event's "bonus"
                                      (bonus / super / epic; there are no retriggers, so at most one)
  .../library/forces/force_record_<mode>.json   the same feature per book, by bonusType (cross-check)

Per spin mode (base, ante, super_ante), the chance that ONE spin starts each feature is
  sum(weight of the books whose bonusStart is that feature) / sum(all weights)
and "1 in N" is its inverse. The max win is a payout of 10,000x the base bet (1,000,000 cents), read
from the lookup table alone. For the bought modes (bonus, super, epic, mystery) nothing lands; the
script prints the max win odds per round and the smallest payout in the table (the floors the rules
page states), so the notes can say which of these the menu may carry.
"""

import csv
import io
import json
import os
import re
import sys

import zstandard

MATH = "/Users/corey/Projects/stake-engine/math-sdk/games/manticore_mayhem/library"
PUB = os.path.join(MATH, "publish_files")
FORCES = os.path.join(MATH, "forces")
MAX_WIN_CENTS = 1_000_000  # 10,000x the base bet (config maxWin)
SPIN_MODES = ["base", "ante", "super_ante"]
BUY_MODES = ["bonus", "super", "epic", "mystery"]
FEATURES = ["bonus", "super", "epic"]
BONUS_RE = re.compile(r'"type": "bonusStart", "bonus": "(\w+)"')


def read_lut(mode):
    ids, weights, pays = [], [], []
    with open(os.path.join(PUB, f"lookUpTable_{mode}_0.csv")) as fh:
        for row in csv.reader(fh):
            ids.append(int(row[0]))
            weights.append(int(row[1]))
            pays.append(int(row[2]))
    return ids, weights, pays


def book_features(mode):
    """book id -> feature, read straight off the books (a regex on the raw line: the
    bonusStart event is written as '"type": "bonusStart", "bonus": "<kind>"')."""
    out = {}
    path = os.path.join(PUB, f"books_{mode}.jsonl.zst")
    with open(path, "rb") as fh:
        reader = io.TextIOWrapper(zstandard.ZstdDecompressor().stream_reader(fh), encoding="utf-8")
        for line in reader:
            if not line.strip():
                continue
            bid = int(line[line.index(":") + 1 : line.index(",")])
            kinds = BONUS_RE.findall(line)
            if len(kinds) > 1:
                raise SystemExit(f"{mode} book {bid} has {len(kinds)} bonusStart events")
            if kinds:
                out[bid] = kinds[0]
    return out


def force_features(mode):
    out = {}
    with open(os.path.join(FORCES, f"force_record_{mode}.json")) as fh:
        for rec in json.load(fh):
            kv = {s["name"]: s["value"] for s in rec["search"]}
            if "bonusType" in kv and kv.get("gametype") == "basegame":
                for bid in rec["bookIds"]:
                    out.setdefault(bid, set()).add(kv["bonusType"])
    return out


def one_in(p):
    return (1.0 / p) if p > 0 else float("inf")


def main():
    index = json.load(open(os.path.join(PUB, "index.json")))
    cost = {m["name"]: m["cost"] for m in index["modes"]}
    result = {"spin": {}, "buy": {}}

    for mode in SPIN_MODES:
        ids, weights, pays = read_lut(mode)
        total = sum(weights)
        feat = book_features(mode)
        forced = force_features(mode)
        # cross-check the books against the force record
        mismatch = sum(1 for i in ids if ({feat[i]} if i in feat else set()) != forced.get(i, set()))
        w_by = {f: 0 for f in FEATURES}
        n_by = {f: 0 for f in FEATURES}
        for i, w in zip(ids, weights):
            f = feat.get(i)
            if f:
                w_by[f] += w
                n_by[f] += 1
        w_max = sum(w for w, p in zip(weights, pays) if p >= MAX_WIN_CENTS)
        w_any = sum(w_by.values())
        row = {
            "cost": cost[mode],
            "books": len(ids),
            "total_weight": total,
            "books_vs_force_mismatches": mismatch,
            "rtp": sum(w * p for w, p in zip(weights, pays)) / total / 100 / cost[mode],
            "features": {
                f: {"books": n_by[f], "p": w_by[f] / total, "one_in": one_in(w_by[f] / total)} for f in FEATURES
            },
            "any_feature": {"p": w_any / total, "one_in": one_in(w_any / total)},
            "max_win": {"books": sum(1 for p in pays if p >= MAX_WIN_CENTS), "p": w_max / total, "one_in": one_in(w_max / total)},
        }
        result["spin"][mode] = row

    for mode in BUY_MODES:
        ids, weights, pays = read_lut(mode)
        total = sum(weights)
        w_max = sum(w for w, p in zip(weights, pays) if p >= MAX_WIN_CENTS)
        result["buy"][mode] = {
            "cost": cost[mode],
            "books": len(ids),
            "rtp": sum(w * p for w, p in zip(weights, pays)) / total / 100 / cost[mode],
            "min_payout_x": min(p for w, p in zip(weights, pays) if w > 0) / 100,
            "max_win": {"p": w_max / total, "one_in": one_in(w_max / total)},
        }

    base = result["spin"]["base"]["features"]
    print("SPIN MODES: one spin starts the feature, 1 in N (exact), and x the base game rate")
    for mode, row in result["spin"].items():
        print(f"\n{mode}  cost {row['cost']:g}x  books {row['books']:,}  RTP {row['rtp']:.6f}  "
              f"books vs force record mismatches: {row['books_vs_force_mismatches']}")
        for f in FEATURES:
            d = row["features"][f]
            ratio = d["p"] / base[f]["p"] if base[f]["p"] else float("nan")
            print(f"  {f:6s} books {d['books']:6,}  p {d['p']:.9f}  1 in {d['one_in']:,.3f}   {ratio:6.2f}x base")
        print(f"  any    p {row['any_feature']['p']:.9f}  1 in {row['any_feature']['one_in']:,.3f}")
        print(f"  max win 10,000x  books {row['max_win']['books']}  1 in {row['max_win']['one_in']:,.1f} spins")
    print("\nBOUGHT MODES (per round)")
    for mode, row in result["buy"].items():
        print(f"  {mode:8s} cost {row['cost']:g}x  RTP {row['rtp']:.6f}  smallest payout {row['min_payout_x']:g}x  "
              f"max win 1 in {row['max_win']['one_in']:,.1f} rounds")

    # (in the repo copy the JSON is written only when asked: --json <path>)
    if "--json" in sys.argv:
        with open(sys.argv[sys.argv.index("--json") + 1], "w") as fh:
            json.dump(result, fh, indent=1)


if __name__ == "__main__":
    sys.exit(main())
