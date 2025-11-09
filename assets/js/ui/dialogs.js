// dialogs.js – small helpers to show confirm/prompt modals via openModal
import { $ } from "../utils/dom.js";
import { openModal } from "./modals.js";

export function confirmDialog(message = "Are you sure?", options = {}) {
	const okText = options.okText || "Confirm";
	const cancelText = options.cancelText || "Cancel";
	return new Promise((resolve) => {
		const close = openModal("confirm-modal");
		const msgEl = $("#confirm-message");
		const okBtn = $("#confirm-ok");
		const cancelBtn = $("#confirm-cancel");
		if (msgEl) msgEl.textContent = message;
		if (okBtn) okBtn.textContent = okText;
		if (cancelBtn) cancelBtn.textContent = cancelText;
		const cleanup = () => {
			okBtn && okBtn.removeEventListener("click", onOk);
			cancelBtn && cancelBtn.removeEventListener("click", onCancel);
		};
		function onOk() {
			cleanup();
			close();
			resolve(true);
		}
		function onCancel() {
			cleanup();
			close();
			resolve(false);
		}
		okBtn && okBtn.addEventListener("click", onOk);
		cancelBtn && cancelBtn.addEventListener("click", onCancel);
	});
}

export function promptDialog({ title = "Rename", label = "Name", value = "", okText = "Save", cancelText = "Cancel" } = {}) {
	return new Promise((resolve) => {
		const close = openModal("prompt-modal");
		const titleEl = $("#prompt-title");
		const labelEl = $("#prompt-label");
		const inputEl = $("#prompt-input");
		const okBtn = $("#prompt-ok");
		const cancelBtn = $("#prompt-cancel");
		if (titleEl) titleEl.textContent = title;
		if (labelEl) labelEl.textContent = label;
		if (inputEl) inputEl.value = value;
		if (okBtn) okBtn.textContent = okText;
		if (cancelBtn) cancelBtn.textContent = cancelText;
		setTimeout(() => inputEl?.focus(), 0);

		const cleanup = () => {
			okBtn && okBtn.removeEventListener("click", onOk);
			cancelBtn && cancelBtn.removeEventListener("click", onCancel);
			inputEl && inputEl.removeEventListener("keydown", onKey);
		};
		function onOk() {
			const v = inputEl?.value?.trim() || "";
			cleanup();
			close();
			resolve(v || null);
		}
		function onCancel() {
			cleanup();
			close();
			resolve(null);
		}
		function onKey(e) {
			if (e.key === "Enter") onOk();
		}
		okBtn && okBtn.addEventListener("click", onOk);
		cancelBtn && cancelBtn.addEventListener("click", onCancel);
		inputEl && inputEl.addEventListener("keydown", onKey);
	});
}


