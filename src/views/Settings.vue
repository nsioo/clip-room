<template>
  <div class="settings">
    <v-divider class="mt-2 mb-2"></v-divider>
    <div class="settings-top">
      <v-btn to="/" text>
        <v-icon small class="mr-2">mdi-chevron-left</v-icon>
        返回
      </v-btn>
      <v-btn to="/" text disabled> 版本号: v{{ appVersion }} </v-btn>
    </div>
    <v-divider class="mt-2 mb-2"></v-divider>

    <h2 class="mt-3">主题颜色</h2>
    <div class="colors mt-2">
      <v-btn class="mr-2" color="primary" @click="editingPrimary = true">编辑默认配色</v-btn>
      <v-btn color="secondary" @click="editingPrimary = false">编辑二级配色</v-btn>
    </div>
    <v-color-picker
      v-if="editingPrimary"
      class="mt-3"
      mode="hexa"
      v-model="primaryColor"
      hide-mode-switch
    />
    <v-color-picker v-else class="mt-3" mode="hexa" v-model="secondaryColor" hide-mode-switch />
    <v-btn class="mt-2" text color="primary" @click="resetColor()">重置主题</v-btn>
  </div>
</template>

<script>
import Vuetify from '../plugins/vuetify';
import { mapGetters, mapState } from 'vuex';

const theme = Vuetify.framework.theme.themes[Vuetify.framework.theme.isDark ? 'dark' : 'light'];
export default {
  name: 'Settings',
  data: () => ({
    primaryColor: theme.primary,
    secondaryColor: theme.secondary,
    editingPrimary: true,

    secretsPlaceholder:
      '4876207845-anjsasd9gjan90dg8as89yd.apps.googleusercontent.com\nDadShg98sduHJDAFs9d8',
    secrets: '',
    loginLoading: false,
    secretRules: [(v) => v.split('\n').length === 2 || 'There must be two lines'],
  }),
  mounted() {
    this.updateSecrets();
  },
  methods: {
    updateSecrets() {
      if (this.auth.ytId !== '' || this.auth.ytSecret !== '')
        this.secrets = this.$store.state.auth.ytId + '\n' + this.$store.state.auth.ytSecret;
    },
    async resetLogin() {
      await this.$store.dispatch('resetYtLogin');
      this.loginLoading = false;
    },
    async login() {
      this.loginLoading = true;
      await this.$store.dispatch('ytLogin');
      this.loginLoading = false;
    },
    async logout() {
      await this.$store.dispatch('ytLogout');
    },
    resetColor() {
      this.primaryColor = '#ed4b83';
      this.secondaryColor = '#5f46ff';
    },
  },
  watch: {
    '$store.state.auth.ytId'() {
      this.updateSecrets();
    },
    '$store.state.auth.ytSecret'() {
      this.updateSecrets();
    },
    async secrets() {
      let splitSecret = this.secrets.split('\n');
      if (splitSecret.length === 2) {
        let [ytId, ytSecret] = splitSecret;
        this.$store.commit('ytId', ytId);
        this.$store.commit('ytSecret', ytSecret);
        await this.$store.dispatch('cacheAuth');
      }
    },
    primaryColor() {
      if (this.primaryColor) {
        this.$vuetify.theme.themes.dark.primary = this.primaryColor;
        this.$vuetify.theme.themes.light.primary = this.primaryColor;
        localStorage.primaryColor = this.primaryColor;
      }
    },
    secondaryColor() {
      if (this.secondaryColor) {
        this.$vuetify.theme.themes.dark.secondary = this.secondaryColor;
        this.$vuetify.theme.themes.light.secondary = this.secondaryColor;
        localStorage.secondaryColor = this.secondaryColor;
      }
    },
  },
  computed: {
    ...mapGetters(['appVersion']),
    ...mapState({
      auth: (state) => state.auth,
    }),
  },
};
</script>

<style scoped>
.settings {
  width: 100%;
  /* overflow-y: auto; */
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  place-items: start;
}

.settings-top {
  display: flex;
  justify-content: space-between;
  width: 100%;
}

.colors {
  display: flex;
}

.secrets {
  width: 100%;
}

.secret-help {
  margin-top: 3px;
  text-align: right;
  font-weight: 500;
}

@media (max-width: 800px) {
  .secret-help {
    display: none;
  }
}

.secret-help > p {
  margin: 7px;
}

.secret-textarea {
  display: flex;
}

.key-saved {
  text-align: right;
}

.account-info {
  display: flex;
  align-items: center;
}

.account-info span {
  font-size: 20px;
}
</style>
