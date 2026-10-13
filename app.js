// Kantong — pencatat pengeluaran bulanan.
// Data disimpan di localStorage browser, jadi tidak hilang saat halaman ditutup.

const STORAGE_KEY = "kantong-data-v1";

const state = loadState();
let bulanAktif = bulanSekarang();

const el = {
  bulan: document.getElementById("bulan"),
  sisa: document.getElementById("sisa"),
  terpakai: document.getElementById("terpakai"),
  limitTeks: document.getElementById("limit-teks"),
  bar: document.getElementById("bar"),
  barFill: document.getElementById("bar-fill"),
  status: document.getElementById("status"),
  formLimit: document.getElementById("form-limit"),
  limitInput: document.getElementById("limit-input"),
  formExpense: document.getElementById("form-expense"),
  nama: document.getElementById("nama"),
  jumlah: document.getElementById("jumlah"),
  kategori: document.getElementById("kategori"),
  tanggal: document.getElementById("tanggal"),
  daftarKategori: document.getElementById("daftar-kategori"),
  rekap: document.getElementById("rekap"),
  rekapKosong: document.getElementById("rekap-kosong"),
  riwayat: document.getElementById("riwayat"),
  riwayatKosong: document.getElementById("riwayat-kosong"),
};

/* ---------- Helper ---------- */

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return { expenses: data.expenses || [], limits: data.limits || {} };
    }
  } catch (e) {
    console.error("Gagal membaca data:", e);
  }
  return { expenses: [], limits: {} };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Gagal menyimpan data:", e);
  }
}

function pad(n) { return String(n).padStart(2, "0"); }

function bulanSekarang() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function hariIni() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const rupiah = (n) => "Rp" + Math.round(n).toLocaleString("id-ID");

function tanggalIndo(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Warna kategori konsisten berdasarkan namanya
function warnaKategori(nama) {
  let h = 0;
  for (const ch of nama.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h}, 55%, 42%)`;
}

// Limit per bulan; kalau belum diatur, pakai limit bulan terakhir sebelumnya
function limitBulan(bulan) {
  if (state.limits[bulan] != null) return state.limits[bulan];
  const sebelumnya = Object.keys(state.limits).filter((b) => b < bulan).sort();
  return sebelumnya.length ? state.limits[sebelumnya[sebelumnya.length - 1]] : 0;
}

function pengeluaranBulan(bulan) {
  return state.expenses
    .filter((e) => e.tanggal.startsWith(bulan))
    .sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1));
}

/* ---------- Render ---------- */

function render() {
  const data = pengeluaranBulan(bulanAktif);
  const total = data.reduce((s, e) => s + e.jumlah, 0);
  const limit = limitBulan(bulanAktif);

  renderGauge(total, limit);
  renderRekap(data, total);
  renderRiwayat(data);
  renderDaftarKategori();
}

function renderGauge(total, limit) {
  el.terpakai.textContent = rupiah(total);
  el.limitTeks.textContent = limit > 0 ? rupiah(limit) : "belum diatur";
  el.limitInput.value = limit > 0 ? limit : "";

  el.barFill.className = "bar-fill";
  el.sisa.classList.remove("over");
  el.status.className = "status";

  if (limit <= 0) {
    el.sisa.textContent = rupiah(0);
    el.barFill.style.width = "0%";
    el.bar.setAttribute("aria-valuenow", 0);
    el.status.textContent = "Atur limit di bawah supaya sisa jatah bisa dihitung.";
    return;
  }

  const persen = Math.min((total / limit) * 100, 100);
  el.barFill.style.width = persen + "%";
  el.bar.setAttribute("aria-valuenow", Math.round(persen));

  if (total > limit) {
    el.sisa.textContent = "-" + rupiah(total - limit);
    el.sisa.classList.add("over");
    el.barFill.classList.add("over");
    el.status.classList.add("over");
    el.status.textContent = `Melewati limit ${rupiah(total - limit)}.`;
  } else {
    el.sisa.textContent = rupiah(limit - total);
    if (persen >= 80) {
      el.barFill.classList.add("warn");
      el.status.textContent = `Sudah ${Math.round(persen)}% dari limit terpakai.`;
    } else {
      el.status.textContent = "";
    }
  }
}

function renderRekap(data, total) {
  el.rekap.innerHTML = "";
  el.rekapKosong.hidden = data.length > 0;
  if (!data.length) return;

  const perKategori = {};
  data.forEach((e) => {
    const k = e.kategori.trim();
    const key = k.toLowerCase();
    if (!perKategori[key]) perKategori[key] = { nama: k, jumlah: 0 };
    perKategori[key].jumlah += e.jumlah;
  });

  Object.values(perKategori)
    .sort((a, b) => b.jumlah - a.jumlah)
    .forEach((k) => {
      const persen = (k.jumlah / total) * 100;
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="rekap-head">
          <span>${escapeHtml(k.nama)} · ${Math.round(persen)}%</span>
          <span>${rupiah(k.jumlah)}</span>
        </div>
        <div class="rekap-bar"><div style="width:${persen}%;background:${warnaKategori(k.nama)}"></div></div>`;
      el.rekap.appendChild(li);
    });
}

function renderRiwayat(data) {
  el.riwayat.innerHTML = "";
  el.riwayatKosong.hidden = data.length > 0;

  data.forEach((e) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div>
        <div class="r-nama">${escapeHtml(e.nama)}</div>
        <div class="r-info">${escapeHtml(e.kategori)} · ${tanggalIndo(e.tanggal)}</div>
      </div>
      <div class="r-jumlah">${rupiah(e.jumlah)}</div>
      <button type="button" class="hapus" data-id="${e.id}" aria-label="Hapus ${escapeHtml(e.nama)}">Hapus</button>`;
    el.riwayat.appendChild(li);
  });
}

// Isi saran kategori dari kategori yang pernah dipakai
function renderDaftarKategori() {
  const unik = new Map();
  state.expenses.forEach((e) => unik.set(e.kategori.toLowerCase(), e.kategori));
  el.daftarKategori.innerHTML = "";
  unik.forEach((nama) => {
    const opt = document.createElement("option");
    opt.value = nama;
    el.daftarKategori.appendChild(opt);
  });
}

/* ---------- Event ---------- */

el.bulan.addEventListener("change", () => {
  if (!el.bulan.value) return;
  bulanAktif = el.bulan.value;
  // tanggal default di form mengikuti bulan yang dipilih
  el.tanggal.value = bulanAktif === bulanSekarang() ? hariIni() : `${bulanAktif}-01`;
  render();
});

el.formLimit.addEventListener("submit", (ev) => {
  ev.preventDefault();
  const nilai = Number(el.limitInput.value);
  if (!(nilai >= 0)) return;
  state.limits[bulanAktif] = nilai;
  saveState();
  render();
});

el.formExpense.addEventListener("submit", (ev) => {
  ev.preventDefault();
  const jumlah = Number(el.jumlah.value);
  if (!(jumlah > 0)) return;

  state.expenses.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    nama: el.nama.value.trim(),
    jumlah,
    kategori: el.kategori.value.trim(),
    tanggal: el.tanggal.value,
  });
  saveState();

  // pindah ke bulan transaksi bila berbeda dari bulan yang sedang dilihat
  const bulanTransaksi = el.tanggal.value.slice(0, 7);
  if (bulanTransaksi !== bulanAktif) {
    bulanAktif = bulanTransaksi;
    el.bulan.value = bulanAktif;
  }

  el.nama.value = "";
  el.jumlah.value = "";
  el.nama.focus();
  render();
});

el.riwayat.addEventListener("click", (ev) => {
  const btn = ev.target.closest(".hapus");
  if (!btn) return;
  state.expenses = state.expenses.filter((e) => e.id !== btn.dataset.id);
  saveState();
  render();
});

/* ---------- Mulai ---------- */

el.bulan.value = bulanAktif;
el.tanggal.value = hariIni();
render();
