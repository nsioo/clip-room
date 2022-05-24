/**
 * 命令 - 基类
 */
export default class Command {
  constructor(name, batchOn = false) {
    this.batchOn = batchOn;
    this.name = name;
  }

  static setStore(store) {
    this.store = store;
  }

  // 执行
  execute() {
    throw new Error('Execute not implemented');
  }

  // 撤回
  undo() {
    throw new Error('Undo not implemented');
  }
}
