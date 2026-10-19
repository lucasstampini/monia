import { CheckCircle2, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import type { AiProviderName, Settings, SettingsInput } from '@shared/types'
import { Button, Select, TextField } from '../components/controls'
import { GroupedRow, GroupedSection } from '../components/GroupedList'
import { Toolbar } from '../components/Toolbar'
import { errorMessage } from '../lib/useAsync'

/** Indicador de segredo salvo. O valor em si nunca volta do main. */
function SecretStatus({ configured }: { configured: boolean }) {
  return configured ? (
    <span className="inline-flex items-center gap-1 text-sm text-label-secondary">
      <CheckCircle2 size={13} className="text-income" /> Salvo
    </span>
  ) : null
}

export function SettingsScreen({ settings, onSaved }: { settings: Settings; onSaved: () => void }) {
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [itemIds, setItemIds] = useState(settings.pluggyItemIds.join('\n'))
  const [aiProvider, setAiProvider] = useState<AiProviderName>(settings.aiProvider)
  const [aiModel, setAiModel] = useState(settings.aiModel)
  const [ollamaUrl, setOllamaUrl] = useState(settings.ollamaUrl)
  const [geminiKey, setGeminiKey] = useState('')
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    const input: SettingsInput = {
      pluggyItemIds: itemIds.split(/[\s,]+/).filter(Boolean),
      aiProvider,
      aiModel,
      ollamaUrl
    }
    // Campos de segredo vazios significam "não alterar".
    if (clientId) input.pluggyClientId = clientId
    if (clientSecret) input.pluggyClientSecret = clientSecret
    if (geminiKey) input.geminiApiKey = geminiKey

    setSaving(true)
    try {
      await window.api.saveSettings(input)
      setClientId('')
      setClientSecret('')
      setGeminiKey('')
      setStatus({ ok: true, text: 'Configurações salvas.' })
      onSaved()
    } catch (error) {
      setStatus({ ok: false, text: errorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Toolbar title="Configurações">
        {status && <span className={`text-sm ${status.ok ? 'text-label-secondary' : 'text-expense'}`}>{status.text}</span>}
        <Button variant="primary" onClick={() => void save()} disabled={saving}>
          Salvar
        </Button>
      </Toolbar>

      <div className="flex-1 overflow-y-auto bg-grouped-bg p-5">
        <form
          className="mx-auto max-w-[640px]"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <GroupedSection
            title="Open Finance (Meu Pluggy)"
            footer={
              <>
                Crie as credenciais em dashboard.pluggy.ai e conecte seus bancos em meu.pluggy.ai. Cada conexão tem um
                Item ID. As credenciais ficam cifradas pelo sistema e nunca saem do processo principal.{' '}
                <a href="https://meu.pluggy.ai" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-accent">
                  Abrir Meu Pluggy <ExternalLink size={11} />
                </a>
              </>
            }
          >
            <GroupedRow label="Client ID">
              <SecretStatus configured={settings.pluggyConfigured} />
              <TextField
                className="w-64"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder={settings.pluggyConfigured ? 'Manter atual' : 'Cole aqui'}
                autoComplete="off"
              />
            </GroupedRow>
            <GroupedRow label="Client Secret">
              <TextField
                className="w-64"
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={settings.pluggyConfigured ? 'Manter atual' : 'Cole aqui'}
                autoComplete="off"
              />
            </GroupedRow>
            <GroupedRow label="Item IDs" detail="Um por linha">
              <textarea
                className="no-drag h-16 w-64 resize-none rounded-control bg-control-bg px-2 py-1 text-base shadow-[var(--shadow-control)] outline-none placeholder:text-label-tertiary"
                value={itemIds}
                onChange={(e) => setItemIds(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </GroupedRow>
          </GroupedSection>

          <GroupedSection
            title="Categorização por IA"
            footer="A IA só recebe descrição limpa, valor e data — nunca nome, documento, conta ou cartão. Só roda no que as regras não resolveram, e cada descrição é enviada uma única vez."
          >
            <GroupedRow label="Provedor">
              <Select value={aiProvider} onChange={(e) => setAiProvider(e.target.value as AiProviderName)}>
                <option value="none">Desativada</option>
                <option value="ollama">Ollama (local)</option>
                <option value="gemini">Gemini</option>
              </Select>
            </GroupedRow>
            {aiProvider !== 'none' && (
              <GroupedRow label="Modelo" detail="Deixe vazio para usar o padrão">
                <TextField
                  className="w-64"
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  placeholder={aiProvider === 'ollama' ? 'llama3.2' : 'gemini-flash-latest'}
                />
              </GroupedRow>
            )}
            {aiProvider === 'ollama' && (
              <GroupedRow label="Endereço do Ollama">
                <TextField className="w-64" value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)} />
              </GroupedRow>
            )}
            {aiProvider === 'gemini' && (
              <GroupedRow label="Chave da API">
                <SecretStatus configured={settings.geminiKeyConfigured} />
                <TextField
                  className="w-64"
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder={settings.geminiKeyConfigured ? 'Manter atual' : 'Cole aqui'}
                  autoComplete="off"
                />
              </GroupedRow>
            )}
          </GroupedSection>
          <button type="submit" hidden />
        </form>
      </div>
    </>
  )
}
