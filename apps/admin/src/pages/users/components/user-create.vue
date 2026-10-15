<script setup lang="ts">
import { UserRoundPlusIcon } from '@lucide/vue'
import { Button } from '@repo/ui/components/button'

import { Modal, ModalContent, ModalTrigger } from '@/components/prop-ui/modal'

import UserResource from './user-resource.vue'

const isOpen = shallowRef(false)
</script>

<template>
  <Modal v-model:open="isOpen">
    <ModalTrigger as-child>
      <Button>
        <UserRoundPlusIcon />
        Create User
      </Button>
    </ModalTrigger>

    <ModalContent>
      <UserResource @close="isOpen = false" />
    </ModalContent>
  </Modal>
</template>
