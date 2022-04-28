<template>
  <div>
    <v-text-field
      prepend-icon="mdi-magnify"
      dense
      clearable
      outlined
      hide-details="auto"
      type="search"
      label="搜索过滤器"
      v-model="term"
    ></v-text-field>
    
    <v-virtual-scroll :bench="1" :items="filteredFilters" height="300" item-height="64">
      <template v-slot:default="{ item: filter }">
        <v-list-item :key="filter.name">
          <v-list-item-content>
            <v-list-item-title>{{ filter.name }}</v-list-item-title>
            <v-list-item-subtitle>{{ filter.description }}</v-list-item-subtitle>
          </v-list-item-content>
          <v-list-item-action>
            <v-btn
              :title="`Show information about ${filter.name}`"
              icon
              @click="openFile('https://ffmpeg.org/ffmpeg-filters.html#' + filter.name)"
            >
              <v-icon>mdi-information-outline</v-icon>
            </v-btn>
          </v-list-item-action>
          <v-list-item-action>
            <v-btn title="Add filter" icon @click="selectFilter(filter)">
              <v-icon>mdi-plus</v-icon>
            </v-btn>
          </v-list-item-action>
        </v-list-item>
      </template>
    </v-virtual-scroll>
  </div>
</template>

<script>
import { mapActions } from 'vuex';

export default {
  name: 'AdvancedExportOptions',
  data: () => ({
    filters: [],
    term: '',
  }),
  async mounted() {
    this.filters = await this.getFilters();
  },
  methods: {
    async selectFilter(filter) {
      let { confirmed, value } = await this.showTextPrompt({
        title: `添加过滤器: ${filter.name}`,
        subtitle: `${filter.description}<br>单击 (i) 了解配置项详情.`,
        value: filter.options,
        label: '参数值 (可选)',
        confirmText: '添加',
        cancelText: '取消',
      });

      if (confirmed) {
        this.$store.commit('addExportFilter', { ...filter, options: value });
      }
    },
    ...mapActions(['getFilters', 'openFile', 'showTextPrompt']),
  },
  computed: {
    filteredFilters() {
      if (this.term === '' || this.term === null) return this.filters;
      return this.filters
        .filter((f) => f.name.includes(this.term) || f.description.includes(this.term))
        .sort((a, b) => b.name.includes(this.term) - a.name.includes(this.term));
    },
  },
};
</script>

<style scoped></style>
