let listeners = [];
let toastId = 0;

export const toast = {
  show: (type, title, description, duration = 4500) => {
    const id = ++toastId;
    const newToast = { id, type, title, description, duration };
    listeners.forEach((listener) => listener(newToast));
    return id;
  },
  success: (title, description, duration) => toast.show('success', title, description, duration),
  error: (title, description, duration) => toast.show('error', title, description, duration),
  info: (title, description, duration) => toast.show('info', title, description, duration),
  draft: (title, description, duration) => toast.show('draft', title, description, duration),
  dismiss: (id) => {
    listeners.forEach((listener) => listener({ id, dismiss: true }));
  },
};

export function subscribeToToasts(callback) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((l) => l !== callback);
  };
}
