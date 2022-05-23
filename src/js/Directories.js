import electron from 'electron';
import fs from 'fs';
import path from 'path';

class Directories {
  constructor() {
    this.temp = this.initializeDir('temp', 'cliproom'); // 临时文件夹
    this.files = this.initializeDir('appData', 'cliproom-files'); // 应用文件夹
    this.videos = this.getDir('videos', ''); // 视频路径
  }

  initializeDir(base, dir) {
    let fullDir = this.getDir(base, dir);
    this.createDir(fullDir);
    return fullDir;
  }

  // 获取路径
  getDir(base = 'music', dir = 'files') {
    let app = electron.app;
    if (electron.hasOwnProperty('remote')) app = electron.remote.app;
    return path.join(app.getPath(base), dir);
  }

  // 创建文件夹
  createDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  }

  // 导入上次文件
  importLSFile() {
    let localStorageFile = path.join(this.files, 'ls.json');

    if (Object.keys(localStorage).length === 0 && fs.existsSync(localStorageFile)) {
      let ls = JSON.parse(fs.readFileSync(localStorageFile));
      console.log('LocalStorage not found, using file', ls);
      for (let key in ls) if (ls.hasOwnProperty(key)) localStorage[key] = ls[key];
    }
  }
}

export default new Directories();
