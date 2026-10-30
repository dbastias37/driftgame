// Accounts and rooms share one origin so HttpOnly session cookies reach both.
window.DRIFT_ONLINE_URL=(location.protocol==='https:'?'wss://':'ws://')+location.host+'/rooms';
