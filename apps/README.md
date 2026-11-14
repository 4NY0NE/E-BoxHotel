# Apps E-BoxHotel

Os apps são gerados automaticamente pelo GitHub Actions (`.github/workflows/build-apps.yml`).

- **Android (.apk)**: Capacitor + Gradle, APK assinado com a chave de debug (instala por "fontes desconhecidas").
- **Windows (.exe)**: `apps/windows` (Go), embute o site e abre numa janela do Edge/Chrome. Sem assinatura digital.

Baixe em: aba **Actions** → última execução → **Artifacts**, ou em **Releases** (quando criar uma tag `v*`).
