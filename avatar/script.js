(function () {
  const origin = window.location.origin;
  const injectUrl = `${origin}/avatar/inject.js`;

  const bookmarkletCode =
    "javascript:(function(){" +
    "var d=document,s=d.createElement('script');" +
    "s.src=" + JSON.stringify(injectUrl) + "+'?t='+Date.now();" +
    "d.body.appendChild(s);" +
    "})();";

  const link = document.getElementById("bookmarklet");
  link.setAttribute("href", bookmarkletCode);
})();
