import path from 'path';

export default class Utils {
    static isProjectFile(filePath) {
        let ext = path.extname(filePath);
        return ext === '.scrproject' || ext === '.SCRPROJECT';
    }

    static readableBytes(bytes, si = true, dp = 1) {
        if (bytes === undefined || bytes === null || isNaN(bytes)) {
            return '0 B';
        }

        const thresh = si ? 1000 : 1024;

        if (Math.abs(bytes) < thresh) {
            return bytes + ' B';
        }

        const units = si
            ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
            : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
        let u = -1;
        const r = 10 ** dp;

        do {
            bytes /= thresh;
            ++u;
        } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);

        return bytes.toFixed(dp) + ' ' + units[u];
    }

    static fixPath(winPath) {
        return winPath.replace(/\\/gi, '/');
    }

    static clamp(x, min = 0, max = 1) {
        return Math.min(max, Math.max(min, x));
    }

    static baseFileName(filePath) {
        return path.basename(filePath);
    }


    static async waitSleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}