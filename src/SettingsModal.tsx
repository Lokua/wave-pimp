import styled from '@emotion/styled'
import { useEffect } from 'react'

import IconButton from './IconButton'
import Select from './Select'
import { BIT_DEPTHS, SAMPLE_RATES, Settings } from './types'

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  z-index: 50;
  -webkit-app-region: no-drag;
`

const ModalCard = styled.section`
  width: min(520px, calc(100vw - 48px));
  padding: 20px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-controls);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
`

const ModalHeader = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
`

const ModalTitle = styled.h2`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
`

const SectionTitle = styled.h3`
  margin: 0 0 12px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.7;
`

const FieldGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(120px, 1fr) minmax(180px, 1.2fr);
  align-items: center;
  gap: 12px 16px;
`

const FieldLabel = styled.label`
  font-size: 12px;
`

type SettingsModalProps = {
  isOpen: boolean
  settings: Settings
  onChangeSettings: (next: Settings) => void
  onClose: () => void
}

export default function SettingsModal({
  isOpen,
  settings,
  onChangeSettings,
  onClose,
}: SettingsModalProps) {
  useEffect(() => {
    if (!isOpen) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  function isSampleRate(value: number): value is Settings['sampleRate'] {
    return SAMPLE_RATES.includes(value as Settings['sampleRate'])
  }

  function isBitDepth(value: number): value is Settings['bitDepth'] {
    return BIT_DEPTHS.includes(value as Settings['bitDepth'])
  }

  function updateSampleRate(value: string) {
    const nextValue = Number(value)
    const nextSampleRate = isSampleRate(nextValue)
      ? nextValue
      : settings.sampleRate
    onChangeSettings({ ...settings, sampleRate: nextSampleRate })
  }

  function updateBitDepth(value: string) {
    const nextValue = Number(value)
    const nextBitDepth = isBitDepth(nextValue) ? nextValue : settings.bitDepth
    onChangeSettings({ ...settings, bitDepth: nextBitDepth })
  }

  return (
    <ModalOverlay onClick={onClose} role="presentation">
      <ModalCard
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(event) => event.stopPropagation()}
      >
        <ModalHeader>
          <ModalTitle>Settings</ModalTitle>
          <IconButton
            type="button"
            name="Close"
            aria-label="Close settings"
            onClick={onClose}
          />
        </ModalHeader>
        <SectionTitle>Export Settings</SectionTitle>
        <FieldGrid>
          <FieldLabel htmlFor="setting-sample-rate">Sample Rate</FieldLabel>
          <Select
            id="setting-sample-rate"
            value={String(settings.sampleRate)}
            options={Array.from(SAMPLE_RATES)}
            onChange={updateSampleRate}
          />
          <FieldLabel htmlFor="setting-bit-depth">Bit Depth</FieldLabel>
          <Select
            id="setting-bit-depth"
            value={String(settings.bitDepth)}
            options={Array.from(BIT_DEPTHS)}
            onChange={updateBitDepth}
          />
        </FieldGrid>
      </ModalCard>
    </ModalOverlay>
  )
}
