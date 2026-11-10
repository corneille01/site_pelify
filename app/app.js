(function () {
  "use strict";
  var el = document.getElementById("hero"),
    btn = document.getElementById("pause");

  // Pause / reprise du carrousel
  if (el && btn && window.bootstrap) {
    var c = bootstrap.Carousel.getOrCreateInstance(el),
      run = true;
    var set = function (on) {
      run = on;
      btn.textContent = on ? "Mettre en pause" : "Reprendre";
      btn.setAttribute("aria-pressed", String(!on));
      if (on) c.cycle();
      else c.pause();
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      set(false);
    btn.addEventListener("click", function () {
      set(!run);
    });
  }

  // Même hauteur pour les 3 slides
  if (el) {
    var items = el.querySelectorAll(".carousel-item");
    var equalize = function () {
      var h = 0;
      items.forEach(function (i) {
        i.style.minHeight = "";
      });
      items.forEach(function (i) {
        var d = i.style.display;
        i.style.display = "block";
        h = Math.max(h, i.offsetHeight);
        i.style.display = d;
      });
      items.forEach(function (i) {
        i.style.minHeight = h + "px";
      });
    };
    window.addEventListener("load", equalize);
    window.addEventListener("resize", equalize);
    if (document.fonts && document.fonts.ready)
      document.fonts.ready.then(equalize);
    equalize();
  }

  // Fermeture du menu mobile après un clic
  var nav = document.getElementById("menu");
  if (nav && window.bootstrap) {
    nav
      .querySelectorAll('a[href^="#"]:not(.dropdown-toggle)')
      .forEach(function (a) {
        a.addEventListener("click", function () {
          if (window.matchMedia("(max-width: 991.98px)").matches) {
            var i = bootstrap.Collapse.getInstance(nav);
            if (i) i.hide();
          }
        });
      });
  }

  // Carte Leaflet du pied de page
  var m = document.getElementById("map");
  if (m && window.L) {
    // Coordonnées approximatives de Foix : à remplacer par celles du 13 avenue Lafayette.
    var LAT = 42.9625,
      LNG = 1.6075;
    var map = L.map(m, {
      scrollWheelZoom: false,
      dragging: !L.Browser.mobile,
      tap: false,
    }).setView([LAT, LNG], 16);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    L.marker([LAT, LNG], {
      icon: L.divIcon({
        className: "",
        html: '<div class="pm"></div>',
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      }),
      keyboard: true,
      title: "PELIFY, 13 avenue Lafagette, Foix",
    })
      .addTo(map)
      .bindPopup("<strong>PELIFY</strong><br>13 avenue Lafagette<br>09000 Foix");
    setTimeout(function () {
      map.invalidateSize();
    }, 300);
  }
})();