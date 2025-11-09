(async function () {
	"use strict";
	const $ = (s) => document.querySelector(s);
	const toggleBtn = $("#toggleSelect");
	const statusEl = $("#selectStatus");
	const chatEl = $("#chatText");
	const refreshBtn = $("#refreshCount");
	const clearBtn = $("#clearSelections");
	const sendBtn = $("#sendAll");
	const noticeEl = $("#notice");

	let selecting = false;

	async function getActiveTab() {
		const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
		return tab;
	}

	function setNotice(msg, isError = false) {
		noticeEl.textContent = msg || "";
		noticeEl.style.color = isError ? "#d33" : "#4e8bff";
	}

	async function updateCount() {
		try {
			const tab = await getActiveTab();
			if (!tab?.id) return;
			const count = await chrome.tabs.sendMessage(tab.id, { type: "get-selections-count" });
			statusEl.textContent = `${count || 0} selected`;
		} catch (e) {
			statusEl.textContent = `0 selected`;
		}
	}

	toggleBtn.addEventListener("click", async () => {
		try {
			const tab = await getActiveTab();
			if (!tab?.id) return;
			if (!selecting) {
				await chrome.tabs.sendMessage(tab.id, { type: "start-select-mode" });
				selecting = true;
				toggleBtn.textContent = "Disable Select Mode";
				setNotice("Select elements on the page. Click here again to stop.");
			} else {
				await chrome.tabs.sendMessage(tab.id, { type: "stop-select-mode" });
				selecting = false;
				toggleBtn.textContent = "Enable Select Mode";
				setNotice("");
			}
			updateCount();
		} catch (e) {
			// Content script might not be injected; inject and ask again
			try {
				const tab = await getActiveTab();
				if (!tab?.id) return;
				await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
				setNotice("Injected helper. Try enabling select mode again.");
			} catch (err) {
				setNotice("Failed to inject helper.", true);
			}
		}
	});

	refreshBtn.addEventListener("click", updateCount);

	clearBtn.addEventListener("click", async () => {
		try {
			const tab = await getActiveTab();
			if (!tab?.id) return;
			await chrome.tabs.sendMessage(tab.id, { type: "clear-selections" });
			updateCount();
	+		setNotice("Cleared selections.");
		} catch (e) {
			setNotice("Nothing to clear.", true);
		}
	});

	sendBtn.addEventListener("click", async () => {
		try {
			const tab = await getActiveTab();
			if (!tab?.id) return;
			const selections = await chrome.tabs.sendMessage(tab.id, { type: "get-selections" });
			const chat = chatEl.value || "";
			if ((!selections || !selections.length) && !chat) {
				setNotice("Nothing to send.", true);
				return;
			}
			await fetch("http://127.0.0.1:9000/bundle", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ chat, picks: selections || [] })
			});
			setNotice("Sent to Cursor.");
		} catch (e) {
			setNotice("Failed to send. Is Cursor running?", true);
		}
	});

	updateCount();
})(); 


