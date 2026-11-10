(function () {
  "use strict";

  // Préremplit le type de projet depuis l'adresse (?projet=ecommerce)
  var params = new URLSearchParams(window.location.search);
  var wanted = params.get("projet");
  var select = document.getElementById("d-projet");
  if (select && wanted) {
    for (var i = 0; i < select.options.length; i++) {
      if (select.options[i].value === wanted) {
        select.selectedIndex = i;
        break;
      }
    }
  }

  document.querySelectorAll("form[data-pform]").forEach(function (form) {
    var msg = form.querySelector(".fmsg");
    var btn = form.querySelector('button[type="submit"]');

    function say(text, ok) {
      if (!msg) return;
      msg.textContent = text;
      msg.className = "fmsg " + (ok ? "ok" : "ko");
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      var label = btn ? btn.textContent : "";
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Envoi en cours";
      }
      say("", true);

      fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(new FormData(form)).toString(),
      })
        .then(function (res) {
          if (!res.ok) throw new Error("http " + res.status);
          form.reset();
          say(form.getAttribute("data-ok") || "Merci, c’est envoyé.", true);
          msg.scrollIntoView({ behavior: "smooth", block: "center" });
        })
        .catch(function () {
          say(
            "L’envoi n’a pas fonctionné. Écrivez-nous à contact@pelify.app ou appelez le +33 7 80 79 18 11.",
            false
          );
        })
        .finally(function () {
          if (btn) {
            btn.disabled = false;
            btn.textContent = label;
          }
        });
    });
  });
})();
