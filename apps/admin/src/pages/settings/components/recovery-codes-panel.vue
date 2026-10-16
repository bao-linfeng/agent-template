<script setup lang="ts">
import { CheckIcon, CopyIcon, DownloadIcon, TriangleAlertIcon } from '@lucide/vue'
import { Alert, AlertDescription } from '@repo/ui/components/alert'
import { Button } from '@repo/ui/components/button'
import { useClipboard } from '@vueuse/core'

import { AUTH_CONFIG } from '@/config/auth'
import { downloadText, recoveryCodesFilename, recoveryCodesText } from '@/lib/two-factor'
import { useAuthStore } from '@/stores/auth'

/** Freshly issued recovery codes; they cannot be shown again once this panel is gone. */
const props = defineProps<{ codes: string[] }>()

const authStore = useAuthStore()
const account = computed(() => authStore.user?.email ?? '')
const text = computed(() => recoveryCodesText(props.codes, { account: account.value, issuer: AUTH_CONFIG.title }))
const { copy, copied, isSupported } = useClipboard({ source: text })

function download() {
  downloadText(recoveryCodesFilename(account.value), text.value)
}
</script>

<template>
  <div class="grid gap-4">
    <Alert>
      <TriangleAlertIcon />
      <AlertDescription>{{ $t('settings.twoFactor.codesDescription') }}</AlertDescription>
    </Alert>
    <ul class="grid grid-cols-2 gap-2 rounded-md border bg-muted/40 p-4 font-mono text-sm">
      <li v-for="code in codes" :key="code" class="text-center tracking-wider">
        {{ code }}
      </li>
    </ul>
    <div class="flex gap-2">
      <Button v-if="isSupported" type="button" variant="outline" size="sm" @click="copy()">
        <CheckIcon v-if="copied" />
        <CopyIcon v-else />
        {{ copied ? $t('settings.twoFactor.copied') : $t('settings.twoFactor.copy') }}
      </Button>
      <Button type="button" variant="outline" size="sm" @click="download">
        <DownloadIcon />
        {{ $t('settings.twoFactor.download') }}
      </Button>
    </div>
  </div>
</template>
