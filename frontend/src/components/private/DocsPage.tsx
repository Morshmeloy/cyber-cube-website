import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { toast } from 'sonner'
import { getUser } from '@/lib/auth.tsx'
import {
  uploadDocument,
  fetchMyDocuments,
  fetchDocumentsRoster,
  fetchDocumentsForUser,
  fetchDocumentPreviewUrl,
  downloadDocument,
  type DocumentItem,
  type UserDocumentsSummary,
} from '@/lib/documents-api.tsx'
import { usePaginatedList } from '@/hooks/usePaginatedList.tsx'
import { Spinner } from '@/components/ui/spinner.tsx'

const fieldClass =
  'w-full rounded-md border border-[var(--cab-text)]/20 bg-[var(--cab-field-bg)]/65 px-2.5 py-2 font-inherit text-[var(--cab-text)] transition-colors focus:border-[var(--plasma-color)] focus:outline-none'
const labelClass = 'mb-1 block text-xs font-semibold text-[var(--cab-text)]/70'
const panelStyle = { background: 'color-mix(in srgb, var(--plasma-color) 6%, var(--cab-panel))', borderColor: 'color-mix(in srgb, var(--plasma-color) 16%, transparent)' }
const panelClass = 'mb-5.5 overflow-x-auto rounded-xl border p-4'

const EXPAND_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>'
const COLLAPSE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>'

function extractErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 403) return 'Нет доступа к этому документу.'
    if (!error.response) return 'Не удалось подключиться к серверу.'
  }
  return fallback
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

/** Раздел «Документы»: у обычного пользователя — сразу свои документы (загрузка + список).
 * У роли с can_view_all_documents — сначала список пользователей (сам первым), клик по
 * себе даёт то же пространство с загрузкой, клик по другому — только просмотр/скачивание
 * его документов, без формы загрузки. */
export function DocsPage() {
  const currentUser = getUser()
  const canViewAll = !!currentUser && (currentUser.role.isSystem || currentUser.role.canViewAllDocuments)

  const [viewingUserId, setViewingUserId] = useState<number | null>(null)
  const [roster, setRoster] = useState<UserDocumentsSummary[] | null>(null)
  const [rosterLoading, setRosterLoading] = useState(false)

  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadFileName, setUploadFileName] = useState('Файл не выбран')
  const [uploading, setUploading] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
  const uploadFileInputRef = useRef<HTMLInputElement>(null)

  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewFullscreen, setPreviewFullscreen] = useState(false)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  const showRoster = canViewAll && viewingUserId === null
  const targetUserId = viewingUserId ?? currentUser?.id ?? 0
  const isOwnSpace = targetUserId === currentUser?.id

  useEffect(() => {
    if (!showRoster) return
    setRosterLoading(true)
    fetchDocumentsRoster()
      .then(setRoster)
      .catch((error) => toast.error(extractErrorMessage(error, 'Не удалось загрузить список пользователей.')))
      .finally(() => setRosterLoading(false))
  }, [showRoster, refreshToken])

  const { page, setPage, totalPages, items, total, loading } = usePaginatedList<DocumentItem>(
    (p, pageSize) => (isOwnSpace ? fetchMyDocuments(p, pageSize) : fetchDocumentsForUser(targetUserId, p, pageSize)),
    `${targetUserId}|${refreshToken}`,
  )

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  async function handleUpload(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    if (!uploadFile || !uploadTitle.trim()) return
    setUploading(true)
    try {
      await uploadDocument(uploadFile, uploadTitle.trim())
      toast.success('Документ загружен.')
      setUploadTitle('')
      setUploadFile(null)
      setUploadFileName('Файл не выбран')
      if (uploadFileInputRef.current) uploadFileInputRef.current.value = ''
      setRefreshToken((t) => t + 1)
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Не удалось загрузить документ.'))
    } finally {
      setUploading(false)
    }
  }

  async function handleRowClick(doc: DocumentItem): Promise<void> {
    if (!doc.isPreviewable) {
      await handleDownload(doc)
      return
    }
    setPreviewDoc(doc)
    setPreviewLoading(true)
    try {
      const url = await fetchDocumentPreviewUrl(doc.id)
      setPreviewUrl(url)
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Не удалось открыть документ.'))
      setPreviewDoc(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  function closePreview(): void {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPreviewDoc(null)
    setPreviewFullscreen(false)
  }

  async function handleDownload(doc: DocumentItem): Promise<void> {
    setDownloadingId(doc.id)
    try {
      await downloadDocument(doc.id, doc.originalFilename)
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Не удалось скачать документ.'))
    } finally {
      setDownloadingId(null)
    }
  }

  if (!currentUser) return null

  if (showRoster) {
    return (
      <div>
        <h3 className="mb-3.5 text-[16px] font-bold text-[var(--plasma-color)] [text-shadow:0_0_6px_color-mix(in_srgb,var(--plasma-color)_50%,transparent)]">Документы — по пользователям</h3>
        {rosterLoading || !roster ? (
          <div className="flex items-center gap-2 py-3 text-sm text-[var(--cab-text)]/70">
            <Spinner className="h-4 w-4" />
            Загрузка…
          </div>
        ) : (
          <div className={panelClass} style={panelStyle}>
            <table className="w-full min-w-[420px] border-collapse text-[16px] text-[var(--cab-text)]/85">
              <thead>
                <tr>
                  {['Пользователь', 'Документов'].map((h) => (
                    <th key={h} className="bg-white/6 px-2.5 py-2 text-left font-bold text-[var(--plasma-color)]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roster.map((u) => (
                  <tr key={u.id} className="cursor-pointer hover:bg-white/4" onClick={() => setViewingUserId(u.id)}>
                    <td className="border-b border-[var(--cab-text)]/8 px-2.5 py-2">
                      {u.fullName || u.username}
                      {u.id === currentUser.id && <span className="ml-2 text-[13px] text-[var(--cab-text)]/50">(вы)</span>}
                    </td>
                    <td className="border-b border-[var(--cab-text)]/8 px-2.5 py-2">{u.documentCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {canViewAll && (
        <button
          type="button"
          onClick={() => setViewingUserId(null)}
          className="mb-3.5 rounded-md border border-[var(--cab-text)]/20 px-2.5 py-1.5 text-[13px] text-[var(--cab-text)]/80 transition-colors hover:bg-white/6"
        >
          ← Назад к списку
        </button>
      )}

      {isOwnSpace && (
        <form onSubmit={(e) => void handleUpload(e)} className="mb-5.5 max-w-[480px] rounded-xl border p-4.5" style={panelStyle}>
          <h3 className="mb-3 text-sm font-bold text-[var(--plasma-color)] [text-shadow:0_0_6px_color-mix(in_srgb,var(--plasma-color)_50%,transparent)]">Загрузить документ</h3>
          <div className="mb-3">
            <label className={labelClass}>Название</label>
            <input type="text" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="Название документа" required className={fieldClass} />
          </div>
          <div className="mb-3">
            <label className={labelClass}>Файл</label>
            <div className="flex items-center gap-2.5">
              <input
                ref={uploadFileInputRef}
                type="file"
                id="docs-upload-file"
                required
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null
                  setUploadFile(file)
                  setUploadFileName(file?.name ?? 'Файл не выбран')
                }}
                className="absolute h-px w-px overflow-hidden border-0 p-0 whitespace-nowrap [clip:rect(0,0,0,0)]"
              />
              <label
                htmlFor="docs-upload-file"
                className="shrink-0 cursor-pointer rounded-md border px-4 py-2 text-xs font-bold tracking-wide text-[var(--plasma-color)] uppercase transition-colors"
                style={{ borderColor: 'var(--plasma-color)', background: 'color-mix(in srgb, var(--plasma-color) 14%, transparent)' }}
              >
                Выбрать файл
              </label>
              <span className="overflow-hidden text-xs text-ellipsis whitespace-nowrap text-[var(--cab-text)]/55">{uploadFileName}</span>
            </div>
          </div>
          <button
            type="submit"
            disabled={uploading}
            className="flex items-center gap-2 rounded-lg border border-[var(--plasma-color)] bg-[var(--plasma-color)] px-5 py-2.5 font-bold text-[var(--cab-bg)] disabled:opacity-50"
          >
            {uploading && <Spinner className="h-4 w-4" />}
            Загрузить
          </button>
        </form>
      )}

      <div className={panelClass} style={panelStyle}>
        <h3 className="mb-3 text-sm font-bold text-[var(--plasma-color)]">{isOwnSpace ? 'Мои документы' : 'Документы пользователя'}</h3>
        {items.length === 0 && !loading ? (
          <div className="px-2.5 py-4 text-center text-[14px] text-[var(--cab-text)]/50">Документов пока нет.</div>
        ) : (
          <table className="w-full min-w-[560px] border-collapse text-[16px] text-[var(--cab-text)]/85">
            <thead>
              <tr>
                {['Название', 'Файл', 'Размер', 'Загружен', ''].map((h) => (
                  <th key={h} className="bg-white/6 px-2.5 py-2 text-left font-bold text-[var(--plasma-color)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((doc) => (
                <tr key={doc.id} className="cursor-pointer hover:bg-white/4" onClick={() => void handleRowClick(doc)}>
                  <td className="border-b border-[var(--cab-text)]/8 px-2.5 py-2">{doc.title}</td>
                  <td className="border-b border-[var(--cab-text)]/8 px-2.5 py-2 text-[var(--cab-text)]/60">{doc.originalFilename}</td>
                  <td className="border-b border-[var(--cab-text)]/8 px-2.5 py-2 text-[var(--cab-text)]/60 whitespace-nowrap">{formatSize(doc.sizeBytes)}</td>
                  <td className="border-b border-[var(--cab-text)]/8 px-2.5 py-2 text-[var(--cab-text)]/60 whitespace-nowrap">{formatDate(doc.createdAt)}</td>
                  <td className="border-b border-[var(--cab-text)]/8 px-2.5 py-2">
                    <button
                      type="button"
                      disabled={downloadingId === doc.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleDownload(doc)
                      }}
                      className="text-[13px] text-[var(--plasma-color)] underline disabled:opacity-50"
                    >
                      Скачать
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {loading && items.length === 0 && (
          <div className="flex items-center justify-center gap-2 py-3 text-sm text-[var(--cab-text)]/70">
            <Spinner className="h-4 w-4" />
            Загрузка…
          </div>
        )}

        {total > 0 && totalPages > 1 && (
          <div className="mt-3 flex items-center justify-center gap-2 text-[13px] text-[var(--cab-text)]/70">
            <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-md border border-[var(--cab-text)]/20 px-2.5 py-1 disabled:opacity-40">
              ◀
            </button>
            <span>
              Стр. {page} из {totalPages}
            </span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded-md border border-[var(--cab-text)]/20 px-2.5 py-1 disabled:opacity-40">
              ▶
            </button>
          </div>
        )}
      </div>

      {previewDoc && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 ${previewFullscreen ? '' : 'p-4'}`} onClick={closePreview}>
          <div
            className={`flex flex-col border p-4 ${previewFullscreen ? 'h-screen w-screen rounded-none' : 'h-[85vh] w-full max-w-[900px] rounded-xl'}`}
            style={panelStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="text-sm font-bold text-[var(--plasma-color)]">{previewDoc.title}</h4>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={previewFullscreen ? 'Свернуть' : 'На весь раздел'}
                  onClick={() => setPreviewFullscreen((v) => !v)}
                  dangerouslySetInnerHTML={{ __html: previewFullscreen ? COLLAPSE_ICON : EXPAND_ICON }}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--cab-text)]/20 p-1.5 text-[var(--cab-text)]/80 transition-colors hover:bg-white/6"
                />
                <button
                  type="button"
                  aria-label="Закрыть"
                  onClick={closePreview}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--cab-text)]/20 text-[18px] leading-none font-light text-[var(--cab-text)]/80 transition-colors hover:bg-white/6"
                >
                  &times;
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden rounded-lg bg-black/20">
              {previewLoading || !previewUrl ? (
                <div className="flex h-full items-center justify-center gap-2 text-sm text-[var(--cab-text)]/70">
                  <Spinner className="h-4 w-4" />
                  Загрузка…
                </div>
              ) : previewDoc.contentType.startsWith('image/') ? (
                <img src={previewUrl} alt={previewDoc.title} className="mx-auto h-full max-w-full object-contain" />
              ) : (
                <iframe src={previewUrl} title={previewDoc.title} className="h-full w-full border-0" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
