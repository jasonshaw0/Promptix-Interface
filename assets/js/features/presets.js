// features/presets.js

class PresetManager {
  constructor(state, stateAPI) {
    this.state = state;
    this.stateAPI = stateAPI;
  }

  get list() {
    return this.state.presets || [];
  }

  add(name, content) {
    const id = `preset-${Date.now()}`;
    const newPreset = { id, name, content };
    this.state.presets = [...this.list, newPreset];
    this.stateAPI.save();
    this.render();
    return newPreset;
  }

  update(id, name, content) {
    const next = this.list.map(p => p.id === id ? { ...p, name, content } : p);
    this.state.presets = next;
    this.stateAPI.save();
    this.render();
    return this.state.presets.find(p => p.id === id);
  }

  delete(id) {
    this.state.presets = this.list.filter(p => p.id !== id);
    this.stateAPI.save();
    this.render();
  }

  render() {
    const containers = Array.from(document.querySelectorAll('.presets-list'));
    if (!containers.length) return;
    containers.forEach(container => {
      container.innerHTML = '';
      this.list.forEach(preset => {
        const el = document.createElement('div');
        el.className = 'preset-item';
        el.dataset.id = preset.id;
        el.innerHTML = `
          <span class="preset-name preset-title" title="Click to add to chat">${preset.name}</span>
          <div class="preset-actions">
            <button class="icon-btn" data-action="edit" title="Edit"><span class="material-symbols-outlined">edit</span></button>
            <button class="icon-btn" data-action="delete" title="Delete"><span class="material-symbols-outlined">delete</span></button>
          </div>
        `;
        container.appendChild(el);
      });
    });
  }
}

export { PresetManager };
