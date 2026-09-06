/**
 * The RGS error code (ERR_*) inside whatever a failed request threw, and nothing else: consoles
 * must never carry the payload (front-end communication: "no game information is being logged" —
 * a play response is the whole book). Falls back to a bare status/label, never the object.
 */
export const rgsErrorCode = (error: unknown): string => {
	const e = error as any;
	if (!e) return 'unknown';
	if (typeof e === 'string') return e.match(/ERR_[A-Z]+/)?.[0] ?? 'error';
	const direct = [e.error, e.error?.statusCode, e.error?.code, e.statusCode, e.code, e.status].find(
		(c) => (typeof c === 'string' && c.startsWith('ERR_')) || typeof c === 'number',
	);
	if (direct !== undefined) return String(direct);
	if (e instanceof Error) return e.name;
	return 'error';
};
