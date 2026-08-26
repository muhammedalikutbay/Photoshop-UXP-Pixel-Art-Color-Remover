Bunu Codex'e tek seferde verip **önce projeyi analiz ettirip sonra planı çıkarttıracak** şekilde hazırlamak daha doğru. Özellikle UXP API sürümlerini kendi güncel dokümantasyonundan doğrulamasını istemek önemli.

# Photoshop UXP — Pixel Art Color Remover

Sen kıdemli bir **Adobe Photoshop UXP Plugin geliştiricisi** ve **TypeScript/JavaScript mimarı** olarak çalışıyorsun.

Bu projeyi sıfırdan geliştiriyoruz.

## 1. Projenin Amacı

Adobe Photoshop içerisinde çalışan modern bir **UXP panel plugin'i** geliştirmek istiyoruz.

Plugin'in amacı özellikle **pixel-art görsellerinde belirli renkleri hızlı ve güvenilir şekilde kaldırmak**.

Kullanıcı panel üzerinden istediği kadar renk tanımlayacak. Plugin bu renkleri Photoshop dokümanındaki piksellerde bulacak, ortak bir selection oluşturacak ve kullanıcı komut verdiğinde bu pikselleri silecek.

Temel kullanım:

```text
Photoshop Document
       ↓
UXP Panel
       ↓
Renkler ekle
       ↓
#FF00FF
#00FF00
#FFFF00
       ↓
Tolerance belirle
       ↓
Target Layer seç
       ↓
Select & Delete
       ↓
Belirlenen renkler kaldırılır
```

## 2. Önemli Gereksinim

Bu proje **eski ExtendScript/JSX tabanlı bir script olmayacak.**

Modern:

**Adobe Photoshop UXP Plugin API**

kullanılacak.

Güncel Adobe Photoshop ve UXP API dokümantasyonunu araştır ve kullandığın API'lerin güncel sürümle uyumlu olduğunu doğrula.

API hakkında varsayım yapma.

Özellikle şu konularda güncel resmi Adobe dokümantasyonunu kontrol et:

* UXP Plugin manifest
* Photoshop API
* `photoshop`
* `executeAsModal`
* Imaging API
* Selection API
* Layer API
* Document API
* Storage API
* BatchPlay gerekiyorsa güncel kullanımı
* UXP Spectrum / UI bileşenleri
* Plugin development/debugging

Mümkün olduğunca resmi Adobe kaynaklarını temel al.

---

# 3. Teknik Hedef

Projeyi:

* TypeScript
* Modern JavaScript
* UXP
* Photoshop API
* HTML/CSS gerekiyorsa minimum seviyede
* modüler mimari

ile geliştir.

Framework kullanmak zorunda değilsin.

React gibi bir framework ancak gerçekten avantaj sağlıyorsa kullan.

UXP ortamında gereksiz abstraction ve dependency oluşturma.

Öncelik:

**stabilite > basitlik > performans > görsel özellikler**

---

# 4. Ana Özellikler

## 4.1 Color List

Kullanıcı istediği kadar renk ekleyebilmeli.

Her renk:

```text
Color Preview
HEX
Delete
```

şeklinde gösterilmeli.

Örneğin:

```text
┌──────────────────────────────┐
│ Colors                       │
│                              │
│ ■ #FF00FF              🗑    │
│ ■ #00FF00              🗑    │
│ ■ #FFFF00              🗑    │
│                              │
│ + Add Color                  │
└──────────────────────────────┘
```

Renk ekleme:

* HEX input
* mümkünse Photoshop color picker entegrasyonu
* geçersiz HEX değerlerini kabul etme

---

# 5. Tolerance

Kullanıcı:

```text
Tolerance: 0–255
```

belirleyebilmeli.

Varsayılan:

```text
0
```

olmalı.

Pixel-art kullanımında tolerance `0` olduğunda yalnızca tam eşleşen renkler hedeflenmeli.

Tolerance > 0 olduğunda uygun renk mesafesi yaklaşımı kullanılmalı.

Burada Photoshop API'nin desteklediği gerçek renk-selection mekanizmasını araştır.

Kendi renk karşılaştırma algoritmamızı kullanmak zorunda olup olmadığımızı değerlendir.

---

# 6. Selection Mantığı

Birden fazla renk olduğunda her renk için ayrı ayrı delete yapmak istemiyoruz.

Örneğin:

```text
Colors:

#FF00FF
#00FF00
#FFFF00
```

Plugin mümkün olan en verimli yöntemle bunların tamamını tek bir selection içerisinde birleştirmeli.

Mantıksal olarak:

```text
Color A
   ↓
Selection

Color B
   ↓
Add to Selection

Color C
   ↓
Add to Selection

Final Selection
   ↓
Delete
```

Ancak Photoshop UXP API daha iyi bir yöntem sunuyorsa onu kullan.

Burada performans ve API sınırlarını araştır.

---

# 7. Delete İşlemi

Ana buton:

```text
SELECT & DELETE
```

olmalı.

İşlem:

1. Document kontrolü
2. Target layer kontrolü
3. Renk listesini doğrula
4. Selection oluştur
5. Selection sonucunu kontrol et
6. Hedef pikselleri sil
7. Selection'ı temizle
8. Kullanıcıya sonuç bildir

Delete işlemleri mümkün olduğunca:

```javascript
executeAsModal(...)
```

içerisinde yapılmalı.

Photoshop'un undo sisteminin doğru çalışmasına dikkat et.

İdeal olarak tüm işlem tek bir undo step olarak davranmalı.

---

# 8. Layer Target

İlk sürümde:

```text
Target

○ Active Layer
○ All Visible Layers
```

desteği planla.

Ancak Photoshop API'nin buna gerçekten nasıl izin verdiğini araştır.

Eğer "All Visible Layers" doğrudan güvenilir şekilde desteklenmiyorsa V1'de yalnızca Active Layer ile başlayıp mimariyi genişletilebilir bırak.

Kullanıcıya çalışmayan bir özellik sunma.

---

# 9. Preset Sistemi

Renk listeleri kaydedilebilmeli.

Örneğin:

```text
Presets

Pixel Art Basic
Pixel Art Outline
Pixel Art Background
Custom
```

Preset:

```json
{
  "name": "Pixel Art Basic",
  "colors": [
    "#FF00FF",
    "#00FF00",
    "#FFFF00"
  ],
  "tolerance": 0
}
```

şeklinde saklanabilir.

UXP Storage API kullan.

Preset işlemleri:

* Save
* Load
* Delete
* Rename

olmalı.

Ancak V1'in temel color-removal özelliği tamamlanmadan preset sistemine gereksiz zaman harcama.

---

# 10. UI

Panel sade ve Photoshop'a uygun görünmeli.

Öncelik:

* kompakt
* hızlı
* okunabilir
* keyboard friendly
* dark Photoshop UI ile uyumlu

Önerilen yapı:

```text
┌──────────────────────────────┐
│ Pixel Color Remover          │
├──────────────────────────────┤
│ COLORS                       │
│                              │
│ ■ #FF00FF              ×     │
│ ■ #00FF00              ×     │
│ ■ #FFFF00              ×     │
│                              │
│ + Add Color                  │
│                              │
├──────────────────────────────┤
│ SETTINGS                     │
│                              │
│ Tolerance     [ 0 ]          │
│                              │
│ Target                       │
│ ○ Active Layer               │
│ ○ Visible Layers             │
│                              │
├──────────────────────────────┤
│                              │
│ [ Select ]  [ Select & Delete]│
└──────────────────────────────┘
```

UI'ı gereksiz yere karmaşıklaştırma.

---

# 11. Mimari

Kodun tek bir `index.js` dosyasına dönüşmesine izin verme.

Önerilen yapı:

```text
src/
├── main.ts
│
├── core/
│   ├── color/
│   │   ├── Color.ts
│   │   ├── ColorParser.ts
│   │   └── ColorValidator.ts
│   │
│   ├── selection/
│   │   └── SelectionService.ts
│   │
│   ├── deletion/
│   │   └── ColorRemovalService.ts
│   │
│   └── layers/
│       └── LayerService.ts
│
├── presets/
│   ├── Preset.ts
│   └── PresetService.ts
│
├── photoshop/
│   └── PhotoshopService.ts
│
├── ui/
│   ├── ColorList.ts
│   ├── ColorPicker.ts
│   ├── SettingsPanel.ts
│   └── StatusMessage.ts
│
└── state/
    └── AppState.ts
```

Bu sadece başlangıç önerisidir.

Kodlamaya başlamadan önce daha iyi bir mimari görüyorsan onu tercih et.

---

# 12. SOLID

Kod:

* Single Responsibility
* Open/Closed
* Liskov Substitution
* Interface Segregation
* Dependency Inversion

ilkelerine uygun tasarlanmalı.

Ancak SOLID uğruna gereksiz interface ve abstraction üretme.

Küçük bir plugin için over-engineering yapma.

---

# 13. Error Handling

Plugin Photoshop dokümanı açık değilken çökmemeli.

Kontroller:

```text
No document
No active layer
No colors
Invalid HEX
Invalid tolerance
Unsupported layer type
Selection failure
Delete failure
Storage failure
Photoshop API error
```

durumlarını düzgün ele al.

Kullanıcıya teknik stack trace göstermek yerine anlaşılır hata mesajları göster.

Developer/debug modunda detaylı log üret.

---

# 14. Logging

Basit bir logger oluştur:

```text
Logger.debug()
Logger.info()
Logger.warn()
Logger.error()
```

Production UI'a gereksiz log basma.

---

# 15. Performance

Pixel-art görselleri küçük olsa da mimari gereksiz şekilde her pikseli JavaScript tarafında dolaşmamalı.

Öncelikle Photoshop'un native API imkanlarını kullan.

Özellikle:

* Imaging API
* selection işlemleri
* Photoshop native operations
* batchPlay

arasında performans karşılaştırması yap.

Eğer belirli bir yöntemin API limitleri varsa bunu dokümante et.

---

# 16. Test Edilmesi Gerekenler

Test senaryoları oluştur:

### Test 1

Tek renk:

```text
#FF00FF
Tolerance = 0
```

### Test 2

Üç renk:

```text
#FF00FF
#00FF00
#FFFF00
```

### Test 3

Aynı renk birden fazla yerde.

### Test 4

Transparency içeren pixel art.

### Test 5

Tolerance = 10.

### Test 6

Yanlış HEX.

### Test 7

Color list boş.

### Test 8

Document açık değil.

### Test 9

Birden fazla layer.

### Test 10

Undo.

### Test 11

Büyük görsel.

### Test 12

Indexed/特殊 color mode veya API'nin desteklemediği document mode.

Desteklenmeyen durumları tespit et ve kullanıcıya bildir.

---

# 17. Dokümantasyon

Proje içinde:

```text
README.md
docs/
```

oluştur.

En az:

```text
docs/
├── architecture.md
├── photoshop-api.md
├── development.md
└── roadmap.md
```

oluştur.

`README.md` içerisinde:

* proje amacı
* kurulum
* development
* debugging
* build
* Photoshop'a yükleme
* kullanım
* bilinen limitler

bulunsun.

---

# 18. Geliştirme Süreci

ÖNEMLİ:

Hemen bütün sistemi kodlamaya başlama.

Önce repository'yi incele.

Sonra:

### Phase 1 — Research

Güncel Adobe UXP / Photoshop API dokümantasyonunu araştır.

Özellikle renk selection konusunda hangi API'nin kullanılabileceğini doğrula.

### Phase 2 — Architecture

Teknik çözümü belirle.

### Phase 3 — Plan

Implementation plan oluştur.

### Phase 4 — Scaffold

Plugin'in temel yapısını oluştur.

### Phase 5 — MVP

Önce yalnızca:

```text
HEX color
+
Active Layer
+
Tolerance
+
Select
+
Delete
```

özelliklerini çalıştır.

### Phase 6

Preset sistemi.

### Phase 7

UI polish.

### Phase 8

Testing + documentation.

---

# 19. Kritik Kural

Bir API'nin var olduğunu varsayma.

Örneğin:

```text
photoshop.selection.selectColor()
```

gibi bir API olduğunu varsayarak kod yazma.

Önce resmi Adobe dokümantasyonunda doğrula.

Eğer doğrudan API yoksa:

1. Photoshop Imaging API
2. BatchPlay
3. Native Photoshop command
4. alternatif UXP yaklaşımı

araştır.

Son çare olarak piksel verisini okuyup işleme yaklaşımını değerlendir.

Ama performans ve UXP güvenlik/sandbox limitlerini dikkate al.

---

# 20. Çalışma Prensibi

Her aşamada:

```text
ANALYZE
↓
PLAN
↓
IMPLEMENT
↓
TEST
↓
VERIFY
↓
DOCUMENT
```

uygula.

Bir özellik tamamlandı diye varsayma.

Gerçekten çalıştığını test et.

Bir API çalışmıyorsa workaround uydurma; nedenini araştır ve mimariyi buna göre değiştir.

---

# 21. İlk Görev

Şu anda kod yazmaya başlama.

Önce:

1. Repository'yi incele.
2. Mevcut dosyaları analiz et.
3. Güncel Adobe UXP/Photoshop API dokümantasyonunu araştır.
4. Özellikle **birden fazla sabit rengin Photoshop dokümanında selection'a dönüştürülüp silinmesi** problemini araştır.
5. Kullanılabilecek API alternatiflerini karşılaştır.
6. Teknik olarak en güvenilir yaklaşımı seç.
7. Proje mimarisini oluştur.
8. Implementation planını hazırla.
9. `AGENTS.md` oluştur ve bu projedeki geliştirme kurallarını oraya yaz.
10. `docs/` altındaki gerekli dokümantasyon dosyalarını oluştur.

Bunları yaptıktan sonra bana:

```text
## Research Findings
## Chosen Technical Approach
## Architecture
## Implementation Plan
## Risks / API Limitations
## Files Created
## Next Step
```

formatında kısa bir rapor ver.

**İlk aşamada MVP kodunu yazma.**

Önce araştırma ve mimariyi doğrula.
