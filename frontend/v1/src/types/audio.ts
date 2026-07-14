export interface AudioEngine {
  startKubSound(): void
  stopKubSound(): void
  playSnapBoom(): void
  playPlasmaOpen(): void
  playPlasmaClose(): void
  startIdleRotateSound(): void
  stopIdleRotateSound(): void
}
