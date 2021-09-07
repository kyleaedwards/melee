/**
 * Valid clocks per measure values to calculate note lengths. To
 * support at least 8th note triplets, the value must be a multiple
 * of 24.
 *
 * @internal
 */
export type CPM = 24 | 48 | 96 | 192 | 384;

/**
 * The global clocks per measure value. Can be exposed to the runtime
 * to allow implementations to know how often to send clock pulses.
 */
export const CLOCKS_PER_MEASURE: CPM = 48;
export const DEFAULT_NOTE_DURATION = CLOCKS_PER_MEASURE / 16;