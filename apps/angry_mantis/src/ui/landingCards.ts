import { stamp } from '../game/assets';

// Landing-screen feature tour (design: "Mantis Landing" artifact, approved 2026-08-26).
// Built entirely from art the game already ships — the Game Info tile thumbnails.
// NOTE: no guaranteed-floor (300×) figure here by explicit decision.
export type LandingCard = { title: string; body: string; images: string[] };

const tile = (name: string) => stamp(`/assets/tiles/${name}.webp`);

export const LANDING_CARDS: LandingCard[] = [
	{
		title: 'MANTIS STRIKES',
		body: 'Dinner Leaves land carrying the next insect on the menu. Every leaf is a strike — the mantis eats it and it leaves the reels for good.',
		images: [tile('gl')],
	},
	{
		title: 'CLEAR THE MENU',
		body: 'Eight courses, eaten lowest-paying first. Fewer symbols left means the rest land more often — wins escalate as the feast goes on.',
		images: [tile('l4'), tile('m2'), tile('m1'), tile('h1')],
	},
	{
		title: 'THREE FREE GAME MODES',
		body: '3, 4 or 5 Markys trigger Free Spins, Super Free Spins or the Mantis Feast — with both mantises feeding at once.',
		images: [tile('s')],
	},
	{
		title: 'WIN UP TO 20,000×',
		body: '1,024 ways across 5×4 reels. Eat all eight symbols and the round pays the 20,000× max win on the spot.',
		images: [tile('w')],
	},
];
