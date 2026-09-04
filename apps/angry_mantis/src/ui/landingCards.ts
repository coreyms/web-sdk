import { stamp } from '../game/assets';
import { soc } from '../game/social';

// Landing-screen feature tour (design: "Mantis Landing" artifact, approved 2026-08-26).
// Built entirely from art the game already ships — the Game Info tile thumbnails.
// NOTE: no guaranteed-floor (300×) figure here by explicit decision.
// Player-visible copy: gambling vocabulary (paying/pays/…) goes through soc(), exactly like
// gameInfoText.ts — stake.us social sessions must never see it.
export type LandingCard = { course: string; title: string; body: string; images: string[]; cover?: boolean };

const tile = (name: string) => stamp(`/assets/tiles/${name}.webp`);

// Four courses on a meal ticket: each card sells one hook in one breath (Corey 2026-09-04:
// "marketing material"). No floor figure, no odds, nothing a reviewer could read as a promise.
export const LANDING_CARDS: LandingCard[] = [
	{
		// the menu cover (Corey 2026-09-04): title + the one-paragraph pitch, no mechanics
		course: 'MENU',
		title: 'MANTIS CAFETERIA FEAST',
		body: soc(
			'Marty and Marky run the meanest cafeteria in Block B, and the menu is eight kinds of bug. Land Markys to open the free games, where every course eaten makes the rest hit harder — all the way up to a 20,000× max win.',
			'Marty and Marky run the meanest cafeteria in Block B, and the menu is eight kinds of bug. Land Markys to open the free games, where every course eaten makes the rest hit harder — all the way up to a 20,000× max win.',
		),
		images: [stamp('/assets/ui/mantis-head.png')],
		cover: true,
	},
	{
		course: 'FIRST COURSE',
		title: 'STRIKE. EAT. REPEAT.',
		body: 'In the free games, every Dinner Leaf serves up the next insect on the menu. Marty strikes, the plate clears, and that symbol is off the reels for the rest of the feast.',
		images: [tile('gl')],
	},
	{
		course: 'SECOND COURSE',
		title: 'CLEAR THE MENU',
		body: soc(
			'Free games eat the menu lowest-paying first, one course at a time. Every symbol gone makes the rest land harder — the longer the feast runs, the bigger it pays.',
			'Free games eat the menu lowest-value first, one course at a time. Every symbol gone makes the rest land harder — the longer the feast runs, the bigger it wins.',
		),
		images: [tile('l4'), tile('m2'), tile('m1'), tile('h1')],
	},
	{
		course: 'THIRD COURSE',
		title: 'THREE WAYS TO FEAST',
		body: soc(
			'3 Markys open Free Spins. 4 bring on the Super Free Spins. 5 sit both mantises down for the Mantis Feast — or buy straight in from the Chow Line.',
			'3 Markys open Free Spins. 4 bring on the Super Free Spins. 5 sit both mantises down for the Mantis Feast — or trigger one instantly from the Chow Line.',
		),
		images: [tile('s')],
	},
	{
		course: 'THE BIG PLATE',
		title: '20,000× MAX WIN',
		body: soc(
			'1,024 ways across 5×4 reels. Clear all eight symbols and the round pays the 20,000× max win on the spot.',
			'1,024 ways across 5×4 reels. Clear all eight symbols and the round wins the 20,000× max win on the spot.',
		),
		images: [tile('w')],
	},
];
