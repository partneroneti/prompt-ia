// In-memory store for pending actions (production would use Redis)
const pendingActions = new Map();

const generateToken = () => {
    return Math.random().toString(36).substr(2, 16).toUpperCase();
};

const storePendingAction = (actionData) => {
    const token = generateToken();
    pendingActions.set(token, {
        ...actionData,
        createdAt: Date.now()
    });

    // Auto-expire after 5 minutes
    setTimeout(() => {
        pendingActions.delete(token);
    }, 5 * 60 * 1000);

    return token;
};

const getPendingAction = (token) => {
    return pendingActions.get(token);
};

const deletePendingAction = (token) => {
    return pendingActions.delete(token);
};

module.exports = {
    storePendingAction,
    getPendingAction,
    deletePendingAction
};
