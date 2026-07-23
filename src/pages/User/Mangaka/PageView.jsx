import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import ChapterAnnotator from './ChapterAnnotator.jsx'

export default function PageView({
  seriesList,
  chapterRows,
  onUploadComplete,
  onUploadProgress,
  STATUS_BADGE,
  annotateSeries,
  setAnnotateSeries,
  annotateSeriesId,
  seriesOptions,
  annotatorChapterNum,
  setAnnotatorChapterNum,
  annotateChapterHint,
  annotatorChapters,
  setAnnotatorChapters,
  annotatorActiveChapterId,
  setAnnotatorActiveChapterId,
  annotatorPageIndex,
  setAnnotatorPageIndex,
  annotatorNotes,
  setAnnotatorNotes,
  annotatorServerChapterId,
  hiredAssistants,
  onOpenAssistantsTab,
  onSendToAssistant,
  onSendToTantou,
  onAcceptAssistantChapter,
  onRejectAssistantChapter,
}) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Không gian làm việc & Tải trang</h1>
        <p className="text-sm text-muted-foreground">Chọn Series và Chapter để xem, tải lên trang hoặc ghi chú giao việc cho Assistant.</p>
      </div>

      <ChapterAnnotator
        selectedSeriesTitle={annotateSeries}
        selectedSeriesId={annotateSeriesId}
        onSelectedSeriesTitleChange={setAnnotateSeries}
        seriesOptions={seriesOptions}
        chapterNum={annotatorChapterNum}
        onChapterNumChange={setAnnotatorChapterNum}
        chapterNumHint={annotateChapterHint}
        chapters={annotatorChapters}
        setChapters={setAnnotatorChapters}
        activeChapterId={annotatorActiveChapterId}
        setActiveChapterId={setAnnotatorActiveChapterId}
        pageIndex={annotatorPageIndex}
        setPageIndex={setAnnotatorPageIndex}
        notes={annotatorNotes}
        setNotes={setAnnotatorNotes}
        serverChapterId={annotatorServerChapterId}
        hiredAssistants={hiredAssistants}
        onOpenAssistantsTab={onOpenAssistantsTab}
        onUploadProgress={onUploadProgress}
        onUploadComplete={onUploadComplete}
        onSendToAssistant={onSendToAssistant}
        onSendToTantou={onSendToTantou}
        onAcceptAssistantChapter={onAcceptAssistantChapter}
        onRejectAssistantChapter={onRejectAssistantChapter}
      />
    </div>
  )
}
