<script lang="ts">
    import { onMount } from 'svelte';

    let deferredPrompt = $state<Event | null>(null);
    let showAndroidBanner = $state(false);
    let showIOSBanner = $state(false);
    let dismissed = $state(false);

    onMount(() => {
        // Don't show if already installed (running in standalone mode)
        if (window.matchMedia('(display-mode: standalone)').matches) return;
        // Don't show if user already dismissed this session
        if (sessionStorage.getItem('re2_pwa_dismissed')) return;

        // Android/Chrome: capture the install event before it fires
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            showAndroidBanner = true;
        });

        // iOS Safari: no install event — detect and show manual instructions
        const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        if (isIOS && isSafari) {
            showIOSBanner = true;
        }
    });

    async function installAndroid() {
        if (!deferredPrompt) return;
        // @ts-ignore
        deferredPrompt.prompt();
        // @ts-ignore
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        showAndroidBanner = false;
    }

    function dismiss() {
        dismissed = true;
        showAndroidBanner = false;
        showIOSBanner = false;
        sessionStorage.setItem('re2_pwa_dismissed', '1');
    }
</script>

{#if !dismissed}
    {#if showAndroidBanner}
        <div class="pwa-banner">
            <div class="pwa-icon">RE²</div>
            <div class="pwa-text">
                <div class="pwa-title">Add RE² to your home screen</div>
                <div class="pwa-sub">Analyze locations instantly from your phone</div>
            </div>
            <button class="pwa-install-btn" onclick={installAndroid}>Add</button>
            <button class="pwa-dismiss" onclick={dismiss}>✕</button>
        </div>
    {/if}

    {#if showIOSBanner}
        <div class="pwa-banner pwa-ios">
            <div class="pwa-icon">RE²</div>
            <div class="pwa-text">
                <div class="pwa-title">Install RE² on your iPhone</div>
                <div class="pwa-sub">Tap <strong>Share</strong> <span class="share-icon">⎋</span> then <strong>"Add to Home Screen"</strong></div>
            </div>
            <button class="pwa-dismiss" onclick={dismiss}>✕</button>
        </div>
    {/if}
{/if}

<style>
    .pwa-banner {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: #1e3a2a;
        color: #fff;
        padding: 14px 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 9999;
        box-shadow: 0 -2px 16px rgba(0,0,0,0.2);
        padding-bottom: calc(14px + env(safe-area-inset-bottom));
    }

    .pwa-icon {
        width: 44px;
        height: 44px;
        border-radius: 10px;
        background: #4a7c59;
        color: #fff;
        font-family: Georgia, serif;
        font-size: 13px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .pwa-text { flex: 1; min-width: 0; }

    .pwa-title {
        font-size: 13px;
        font-weight: 700;
        color: #fff;
        line-height: 1.3;
    }

    .pwa-sub {
        font-size: 11px;
        color: #a3c4a8;
        margin-top: 2px;
        line-height: 1.4;
    }

    .pwa-sub strong { color: #fff; }

    .share-icon {
        font-size: 13px;
        display: inline-block;
        vertical-align: middle;
    }

    .pwa-install-btn {
        background: #f5f0e8;
        color: #1e3a2a;
        border: none;
        border-radius: 8px;
        padding: 8px 16px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        flex-shrink: 0;
        font-family: inherit;
    }

    .pwa-dismiss {
        background: transparent;
        border: none;
        color: #7bbf94;
        font-size: 16px;
        cursor: pointer;
        padding: 4px;
        flex-shrink: 0;
        line-height: 1;
    }
</style>
