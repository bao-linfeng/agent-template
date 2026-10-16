<script setup lang="ts">
import { Button } from '@repo/ui/components/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@repo/ui/components/dialog'
import { Input } from '@repo/ui/components/input'
import { Label } from '@repo/ui/components/label'
import { Spinner } from '@repo/ui/components/spinner'
import { toast } from 'vue-sonner'

import { t } from '@/plugins/i18n'
import { useDisableTotpMutation, useRegenerateRecoveryCodesMutation } from '@/services/api/me.api'

import RecoveryCodesPanel from './recovery-codes-panel.vue'

/** Turning two-factor authentication off or replacing the recovery codes: password plus a current code. */
const props = defineProps<{ mode: 'disable' | 'regenerate' }>()
const open = defineModel<boolean>('open', { default: false })

const password = shallowRef('')
const code = shallowRef('')
const recoveryCodes = shallowRef<string[]>([])

const disable = useDisableTotpMutation()
const regenerate = useRegenerateRecoveryCodesMutation()
const pending = computed(() => disable.isPending.value || regenerate.isPending.value)
const canSubmit = computed(() => password.value !== '' && code.value.trim().length >= 6 && !pending.value)

watch(open, (isOpen) => {
  if (!isOpen)
    return
  password.value = ''
  code.value = ''
  recoveryCodes.value = []
})

async function submit() {
  if (!canSubmit.value)
    return
  const body = { password: password.value, code: code.value.trim() }
  try {
    if (props.mode === 'disable') {
      await disable.mutateAsync(body)
      toast.success(t('settings.twoFactor.disabled'))
      open.value = false
      return
    }
    recoveryCodes.value = (await regenerate.mutateAsync(body)).recoveryCodes
  }
  catch {
    code.value = ''
    // Toasted by the global mutation handler (wrong password or code).
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="sm:max-w-md"
      @interact-outside="(event: Event) => recoveryCodes.length > 0 && event.preventDefault()"
      @escape-key-down="(event: Event) => recoveryCodes.length > 0 && event.preventDefault()"
    >
      <DialogHeader>
        <DialogTitle>
          {{ mode === 'disable' ? $t('settings.twoFactor.disableTitle') : $t('settings.twoFactor.regenerateTitle') }}
        </DialogTitle>
        <DialogDescription v-if="recoveryCodes.length === 0">
          {{ mode === 'disable' ? $t('settings.twoFactor.disableDescription') : $t('settings.twoFactor.regenerateDescription') }}
        </DialogDescription>
      </DialogHeader>

      <template v-if="recoveryCodes.length > 0">
        <RecoveryCodesPanel :codes="recoveryCodes" />
        <DialogFooter>
          <Button type="button" @click="open = false">
            {{ $t('settings.twoFactor.done') }}
          </Button>
        </DialogFooter>
      </template>

      <form v-else class="grid gap-4" novalidate @submit.prevent="submit">
        <div class="grid gap-2">
          <Label :for="`mfa-${mode}-password`">{{ $t('settings.security.currentPassword') }}</Label>
          <Input :id="`mfa-${mode}-password`" v-model="password" type="password" autocomplete="current-password" />
        </div>
        <div class="grid gap-2">
          <Label :for="`mfa-${mode}-code`">{{ $t('settings.twoFactor.codeOrRecovery') }}</Label>
          <Input
            :id="`mfa-${mode}-code`"
            v-model="code"
            autocomplete="one-time-code"
            autocapitalize="off"
            spellcheck="false"
            :placeholder="$t('settings.twoFactor.codeOrRecoveryPlaceholder')"
          />
        </div>
        <DialogFooter>
          <Button
            type="submit"
            :variant="mode === 'disable' ? 'destructive' : 'default'"
            :disabled="!canSubmit"
          >
            <Spinner v-if="pending" class="mr-2" />
            {{ mode === 'disable' ? $t('settings.twoFactor.disable') : $t('settings.twoFactor.regenerate') }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
