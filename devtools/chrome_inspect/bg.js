chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "send-to-cursor",
        title: "Send to Cursor (copy)",
        contexts: ["all"]
    });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== "send-to-cursor") return;
	// Helper to send to MCP bridge
	function postToBridge(data) {
		return fetch("http://127.0.0.1:9000/pick", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data)
		}).catch(err => console.error(String(err)));
	}

	// Request pick from content script
	chrome.tabs.sendMessage(tab.id, { type: "get-last-pick" }, async (result) => {
		if (chrome.runtime.lastError || !result) {
			// Content script might not be injected on this page yet (e.g., tab opened before install).
			// Inject content.js and ask user to try again.
			try {
				await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
				console.log("Injected content.js. Please right-click the element again.");
			} catch (e) {
				console.error("Failed to inject content.js:", e && e.stack ? e.stack : String(e));
			}
			return;
		}
		await postToBridge(result);
	});
});
