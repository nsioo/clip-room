/**
 * 命令 - 添加片段
 */
import Command from '@/js/commands/Command';

export default class AddFragment extends Command {
  constructor(fragment) {
    super('Add fragment');
    this.fragment = fragment; // 要添加的片段
  }

  // 在命令执行前，把要添加的片段添加到时间轴
  execute() {
    if (Command.store.state.activeFragment === null) {
      Command.store.commit('activeFragment', this.fragment);
    }
    Command.store.commit('addToTimeline', { fragment: this.fragment });
  }

  undo() {
    Command.store.commit('removeFromTimeline', this.fragment);
  }
}
