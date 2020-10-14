export class Utils {

    /**
     * Get random time (ms) between min & max
     * @param min The min time in seconds
     * @param max The max time in seconds
     */
    public static getRandomTime(min: number, max: number): number {
        return (Math.random() * (max * 1000 - min * 1000) + min * 1000);
    }
}