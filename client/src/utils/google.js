/** Loads Google Identity Services once and renders its official "Continue with Google" button. */

let scriptPromise;

export function loadGoogleScript() {
  scriptPromise ??= new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve(window.google);
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => {
      scriptPromise = null; // allow a retry
      reject(new Error("Couldn't load Google sign-in. Check your connection and try again."));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * @param {HTMLElement} el
 * @param {string} clientId   public OAuth client id
 * @param {(credential: string) => void} onCredential  receives Google's signed ID token
 */
export async function renderGoogleButton(el, clientId, onCredential) {
  const google = await loadGoogleScript();
  google.accounts.id.initialize({
    client_id: clientId,
    callback: (response) => response?.credential && onCredential(response.credential),
    ux_mode: 'popup',
  });
  el.innerHTML = '';
  google.accounts.id.renderButton(el, {
    type: 'standard',
    theme: document.documentElement.classList.contains('dark') ? 'filled_black' : 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'rectangular',
    logo_alignment: 'left',
    width: Math.min(Math.max(el.clientWidth || 300, 200), 400),
  });
}
