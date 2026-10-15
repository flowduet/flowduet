<script setup lang="ts">
import ContractInstanceProbe from "./ContractInstanceProbe.vue";
</script>
<template>
  <p>仅验证编辑合同；两个实例持有相同业务ID，身份与输入分别归属。</p>
  <ContractInstanceProbe owner="A" /><ContractInstanceProbe
    owner="B"
    :nested="true"
    :invalid-default="true"
  />
</template>
