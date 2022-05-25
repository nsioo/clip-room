import VideoFragment from '@/js/VideoFragment';
import objToCommand from '@/js/commands/objToCommand';

export default {
  state: {
    //Stack index always points to index of command that would be undone
    stackIndex: -1,
    undoStack: [],
    hasUnsavedAction: false,
  },
  mutations: {
    hasUnsavedAction: (state, value) => (state.hasUnsavedAction = value), // 是否有未保存的操作
    stackIndex: (state, index) => (state.stackIndex = index), // 操作栈索引
    undoStack: (state, commands) => (state.undoStack = commands), // 撤消堆栈
    resetCommands: (state) => { // 重置命令
      state.stackIndex = -1;
      state.undoStack.splice(0, state.undoStack.length);
    },
    addCommand: (state, command) => { // 添加撤销命令
      // Erase stack after stackIndex
      state.undoStack.splice(++state.stackIndex);
      state.undoStack.push(command);
    },
    undoCommand: (state) => { // 撤销命令
      while (state.stackIndex > -1) {
        let toUndo = state.undoStack[state.stackIndex--];
        toUndo.undo();
        let nextToUndo = state.undoStack[state.stackIndex];
        if (
          toUndo.batchOn === false ||
          toUndo.batchOn !== nextToUndo?.batchOn ||
          toUndo.constructor.name !== nextToUndo.constructor.name
        )
          break;
      }
    },
    redoCommand: (state) => { // 重做命令
      // When redoing a command, we pick the one to the right of the stackIndex
      while (state.stackIndex < state.undoStack.length - 1) {
        let toRedo = state.undoStack[++state.stackIndex];
        toRedo.execute();
        let nextToRedo = state.undoStack[state.stackIndex + 1];
        if (
          toRedo.batchOn === false ||
          toRedo.batchOn !== nextToRedo?.batchOn ||
          toRedo.constructor.name !== nextToRedo.constructor.name
        )
          break;
      }
    },
  },
  getters: {
    canUndo: (state) => state.stackIndex > -1, // 是否可以撤销
    canRedo: (state) => state.stackIndex < state.undoStack.length - 1, // 是否可以重做
    hasProject: (state, getters, rootState) => rootState.activeFragment !== null, // 是否有片段
    project: (state) => {
      let commands = JSON.parse(JSON.stringify(state.undoStack));
      commands.forEach((c) => delete c.batchOn);
      let fragments = {};
      for (let command of commands) {
        if (command.name === 'Add fragment') fragments[command.fragment.id] = command.fragment;
        if (command.name === 'Split fragment') {
          fragments[command.newFragment.id] = command.newFragment;
          command.newFragment = command.newFragment.id;
        }
        if (command.name === 'Duplicate fragment') {
          fragments[command.newFragment.id] = command.newFragment;
          command.newFragment = command.newFragment.id;
        }
        command.fragment = command.fragment.id;
      }
      return {
        fragments,
        index: state.stackIndex,
        commands,
      };
    },
  },
  actions: {
    // 放弃更改提示
    async discardChangesPrompt({ dispatch, state }) {
      if (state.hasUnsavedAction) {
        return await dispatch('showPrompt', {
          confirmText: '放弃',
        });
      }
      return true;
    },
    // 新项目
    async newProject({ commit, state, dispatch }, overwriteFilePath = true) {
      if (await dispatch('discardChangesPrompt')) dispatch('clearProject', overwriteFilePath);
    },
    // 清空项目
    clearProject({ commit, state }, overwriteFilePath = true) {
      commit('activeFragment', null);
      commit('resetCommands');
      commit('timeline', []);
      commit('progress', 0);
      commit('hasUnsavedAction', false);
      commit('videoFiles', []);
      if (overwriteFilePath) commit('projectFilePath', '');
      commit('videosContainer', null);
    },
    // 导入项目
    async importProject({ dispatch, commit, state }, projectString) {
      commit('importProjectLoading', true);
      await dispatch('clearProject', false);
      let { fragments, index, commands } = JSON.parse(projectString);
      let videos = [...new Set(Object.values(fragments).map((f) => f.video))];
      let videoFiles = await Promise.all(videos.map((v) => dispatch('loadMetadata', v)));
      const recreateFragment = (f) =>
        VideoFragment.fromObject(
          videoFiles.find((v) => v.filePath === f.video),
          f
        );
      for (let id in fragments) {
        if (fragments.hasOwnProperty(id)) fragments[id] = recreateFragment(fragments[id]);
      }
      for (let i = 0; i < commands.length; i++) {
        let command = commands[i];
        command.fragment = fragments[command.fragment];
        if (command.name === 'Split fragment' || command.name === 'Duplicate fragment')
          command.newFragment = fragments[command.newFragment];
      }

      commit('undoStack', commands.map(objToCommand));
      while (state.stackIndex < index) {
        dispatch('redo');
      }
      commit('importProjectLoading', false);
      commit('hasUnsavedAction', false);
    },
    // 执行命令
    executeCommand({ commit, dispatch }, command) {
      commit('hasUnsavedAction', true);
      commit('addCommand', command);
      command.execute();
      dispatch('printUndoStack');
    },
    // 打印撤消堆栈
    printUndoStack({ state }) {
      let result = '';
      for (let i = 0; i < state.undoStack.length; i++) {
        let batch = state.undoStack[i].batchOn;
        result += batch !== false ? '| ' : '- ';
        result += state.undoStack[i].constructor.name;
        if (i === state.stackIndex) {
          result += ' <-- Would be undone';
        }
        if (batch !== false) result += ' : ' + batch;
        result += '\n';
      }
    },
  },
};
