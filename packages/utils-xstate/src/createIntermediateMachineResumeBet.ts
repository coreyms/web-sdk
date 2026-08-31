import { setup, assign } from 'xstate';

import { context, type Context } from './machineContext';
import { surfaceBetError } from './surfaceBetError';
import type { PrimaryMachines } from './types';

export const createIntermediateMachineResumeBet = (actors: {
	resumeGame: PrimaryMachines['resumeGame'];
	playGame: PrimaryMachines['playGame'];
	endGame: PrimaryMachines['endGame'];
}) => {
	const machine =
		/** @xstate-layout N4IgpgJg5mDOIC5QCMwBcB0BLCAbMAxAEICiAKoqAA4D2sWaWNAdpSAB6ICMATAGwYADMMFcA7Dy4BWQQBZZgsQBoQAT24BmMRlkBOfQA4+fXWNl8pu2QF9rK1JgBm6AMYALLMygEILMNmYANxoAa38AWwBXNABDRhYidDZaenjWJA5EKQ0BWS0pHlMNGTE+FXUELlEMGRENXV4pKtFbe3QMZzR3T28wACc+mj6MKlw4xyHwjCjYtMS0ZLoGJnTQTgRs3PzCsWLFMrVEHjFBHX1TWXEzDQ0DGzsQBxGx1R8-AOCw55iK6iW0tjrKxcDAGRo8MEnRQ8crcHinc76QpSMxg3R8WwPZg0CBwNhPHD4RapFaAxCyGGHSoaEGI0oFPT1XStR7tTrdLzE5YsMkIeEGDC6O71LQGYSyMXKKlVXKIvhGc5cUwsp6jH5cgEZdYSXQYDQQrjmBrCKQHCq6U4iYQ0jQiMUaFXtMDMCAa0la7iKbSSAxiX2m4ToykVXgaQXnE5+iwNIyOhYZFLc1aZSoGWGpoRWrNWsSY6xAA */
		setup({
			types: {} as {
				context: Context;
			},
			actors,
		}).createMachine({
			context,
			id: 'resumeBet',
			initial: 'resumeGame',
			states: {
				resumeGame: {
					invoke: {
						id: 'resumeGame',
						src: 'resumeGame',
						onDone: [
							{
								actions: assign(({ context: _, event }) => event.output),
								target: 'play',
							},
						],
						onError: [
							{
								target: 'end',
							},
						],
					},
				},
				play: {
					invoke: {
						id: 'playGame',
						src: 'playGame',
						input: ({ context }) => ({
							bet: context.bet,
						}),
						onDone: [
							{
								target: 'ending',
							},
						],
						// A throw during resumed book playback must not error the invoked actor
						// and stop the root game actor mid-'resumeBet' — surface it and finalise
						// like 'resumeGame' does.
						onError: [
							{
								actions: ({ event }) => surfaceBetError(event.error),
								target: 'end',
							},
						],
					},
				},
				ending: {
					invoke: {
						id: 'endGame',
						src: 'endGame',
						input: ({ context }) => ({
							bet: context.bet,
							rawBet: context.rawBet,
						}),
						onDone: [
							{
								target: 'end',
							},
						],
						onError: [
							{
								actions: ({ event }) => surfaceBetError(event.error),
								target: 'end',
							},
						],
					},
				},
				end: {
					type: 'final',
				},
			},
		});

	return machine;
};
