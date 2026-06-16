import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { defineComponent, h } from 'vue'
import AccountSwitcher from '@/components/AccountSwitcher.vue'
import { useAccountStore } from '@/stores/accountStore'
import { accountKey } from '@/types'
import type { IndexerAccount } from '@/types'

/**
 * Tests for the sidebar AccountSwitcher widget.
 *
 * We use real Pinia (no need for @pinia/testing — the store is synchronous
 * and has no side effects) and a memory-history router stub so `useRouter()`
 * resolves inside the component. PrimeVue's Popover internals are not
 * exercised — they're an external concern. We assert against the structural
 * trigger, the rendered list of account rows, store mutations, and the
 * empty-state CTA.
 */

const StubView = defineComponent({ render: () => h('div') })

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: StubView },
      { path: '/settings', component: StubView },
    ],
  })
}

function makeAccount(overrides: Partial<IndexerAccount> = {}): IndexerAccount {
  return {
    label: 'Primary Indexer',
    address: '0x1234567890abcdef1234567890abcdef12345678',
    chain: 'arbitrum-one',
    agentEndpoint: '',
    graphmanEndpoint: '',
    graphmanToken: '',
    ...overrides,
  }
}

async function mountSwitcher() {
  const router = makeRouter()
  await router.push('/')
  await router.isReady()
  return mount(AccountSwitcher, {
    global: {
      plugins: [router],
      // Stub PrimeVue Popover so we can render rows without instantiating the
      // real component (which depends on directives we don't register here).
      stubs: {
        Popover: defineComponent({
          name: 'Popover',
          setup(_, { slots, expose }) {
            expose({ toggle: () => {}, hide: () => {}, show: () => {} })
            return () => h('div', { class: 'popover-stub' }, slots.default?.())
          },
        }),
      },
    },
  })
}

describe('AccountSwitcher', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it("renders the active account's label on the trigger", async () => {
    const store = useAccountStore()
    const account = makeAccount({ label: 'My Indexer' })
    store.addAccount(account)

    const wrapper = await mountSwitcher()

    const trigger = wrapper.find('[data-testid="account-switcher-trigger"]')
    expect(trigger.exists()).toBe(true)
    expect(trigger.text()).toContain('My Indexer')
  })

  it('renders one row per configured account in the popover', async () => {
    const store = useAccountStore()
    store.addAccount(
      makeAccount({
        label: 'Account A',
        address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        chain: 'mainnet',
      }),
    )
    store.addAccount(
      makeAccount({
        label: 'Account B',
        address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        chain: 'arbitrum-one',
      }),
    )
    store.addAccount(
      makeAccount({
        label: 'Account C',
        address: '0xcccccccccccccccccccccccccccccccccccccccc',
        chain: 'sepolia',
      }),
    )

    const wrapper = await mountSwitcher()

    const rows = wrapper.findAll('[data-testid="account-switcher-row"]')
    expect(rows).toHaveLength(3)

    const labels = rows.map((r) => r.text())
    expect(labels.join(' ')).toContain('Account A')
    expect(labels.join(' ')).toContain('Account B')
    expect(labels.join(' ')).toContain('Account C')
  })

  it('invokes accountStore.setActive with the correct composite key on row click', async () => {
    const store = useAccountStore()
    const accountA = makeAccount({
      label: 'Account A',
      address: '0xAAaaAAaaAAaaAAaaAAaaAAaaAAaaAAaaAAaaAAaa',
      chain: 'mainnet',
    })
    const accountB = makeAccount({
      label: 'Account B',
      address: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
      chain: 'arbitrum-one',
    })
    store.addAccount(accountA)
    store.addAccount(accountB)

    // Account A was added first and auto-actives.
    expect(store.activeAccountKey).toBe(accountKey(accountA))

    const wrapper = await mountSwitcher()

    const rows = wrapper.findAll('[data-testid="account-switcher-row"]')
    expect(rows).toHaveLength(2)

    // Click the second row (Account B) — should switch the active key.
    await rows[1]!.trigger('click')

    expect(store.activeAccountKey).toBe(accountKey(accountB))
  })

  it('renders the "Add account" CTA when no accounts are configured', async () => {
    // accountStore starts empty by default.
    const wrapper = await mountSwitcher()

    const cta = wrapper.find('[data-testid="account-switcher-add-cta"]')
    expect(cta.exists()).toBe(true)
    expect(cta.text()).toContain('Add account')

    // The popover trigger should NOT render in the empty state.
    const trigger = wrapper.find('[data-testid="account-switcher-trigger"]')
    expect(trigger.exists()).toBe(false)
  })
})
