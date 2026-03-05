export function registerServiceWorker(){
  if('serviceWorker' in navigator){navigator.serviceWorker.register('/flutter_signal/sw.js');}
}
