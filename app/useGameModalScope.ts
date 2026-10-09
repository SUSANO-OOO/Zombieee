"use client";
import { useEffect } from "react";

export function useGameModalScope() {
  useEffect(() => {
    let dialog: HTMLElement | null = null;
    let opener: HTMLElement | null = null;
    let background: Array<[HTMLElement, boolean]> = [];
    const restore = () => { for (const [element, inert] of background) element.inert = inert; background = []; };
    const controls = () => dialog ? [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')]
      .filter(element => element.getClientRects().length > 0 && !element.closest("[inert]")) : [];
    const focusFirst = () => { const target = controls()[0] ?? dialog; if (target) { if (target === dialog) target.tabIndex = -1; target.focus({ preventScroll: true }); } };
    const select = () => {
      const dialogs = [...document.querySelectorAll<HTMLElement>('[aria-modal="true"][role="dialog"],[aria-modal="true"][role="alertdialog"]')].filter(element => element.getClientRects().length > 0);
      const next = dialogs.at(-1) ?? null;
      if (next === dialog) return;
      const previous = dialog;
      restore();
      dialog = null;
      if (!next && opener?.isConnected) opener.focus({ preventScroll: true });
      if (next) {
        if (!previous) opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        let branch: HTMLElement = next;
        while (branch.parentElement) {
          for (const sibling of branch.parentElement.children) if (sibling !== branch && sibling instanceof HTMLElement) { background.push([sibling, sibling.inert]); sibling.inert = true; }
          if (branch.parentElement === document.body) break;
          branch = branch.parentElement;
        }
      }
      dialog = next;
      if (dialog) focusFirst();
    };
    const key = (event: KeyboardEvent) => {
      if (!dialog || event.key !== "Tab") return;
      const items = controls(), current = document.activeElement;
      if (!items.length || !dialog.contains(current) || (event.shiftKey ? current === items[0] : current === items.at(-1))) {
        event.preventDefault(); event.stopPropagation();
        (event.shiftKey ? items.at(-1) : items[0])?.focus({ preventScroll: true });
      }
    };
    const focus = (event: FocusEvent) => { if (dialog && event.target instanceof Node && !dialog.contains(event.target)) focusFirst(); };
    const observer = new MutationObserver(select);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("keydown", key, true);
    document.addEventListener("focusin", focus, true);
    select();
    return () => { observer.disconnect(); document.removeEventListener("keydown", key, true); document.removeEventListener("focusin", focus, true); restore(); };
  }, []);
}
