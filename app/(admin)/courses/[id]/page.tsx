import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/dal'
import { loadCategoryNames } from '@/lib/categories'
import { deleteCourse, updateCourse } from '@/lib/actions/courses'
import type { CourseRow } from '@/lib/courses'
import { publicSiteUrl } from '@/lib/supabase/env'
import { Alert, Badge, Card, PageHeader } from '@/components/ui'
import { ConfirmButton } from '@/components/confirm-button'
import { CourseForm } from '../course-form'

export const metadata: Metadata = { title: 'Edit course' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function EditCoursePage({ params }: PageProps<'/courses/[id]'>) {
  const { supabase } = await requireAdmin()
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const [{ data, error }, categories] = await Promise.all([supabase.from('courses').select('*').eq('id', id).maybeSingle(), loadCategoryNames(supabase)])
  if (error) return <Alert tone="error">Could not load this course: {error.message}</Alert>
  if (!data) notFound()
  const course = data as CourseRow

  return (
    <>
      <Link href="/courses" className="mb-4 inline-block text-xs font-bold uppercase tracking-wider text-brand">← All courses</Link>
      <PageHeader title={course.title}
        description={`Last updated ${new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(course.updated_at))}`}
        actions={<>
          {course.is_published ? <Badge tone="success">Published</Badge> : <Badge tone="warning">Draft</Badge>}
          {course.is_published && <a href={`${publicSiteUrl}/courses/${course.slug}`} target="_blank" rel="noreferrer" className="text-xs font-bold uppercase tracking-wider text-brand">View on website ↗</a>}
        </>} />
      <div className="mb-4 flex flex-col gap-3">
      </div>

      <CourseForm action={updateCourse.bind(null, course.id)} course={course} categories={categories} publicSiteUrl={publicSiteUrl} submitLabel="Save changes" />

      <Card className="mt-8 flex flex-col gap-3 border-red-200 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="font-display text-lg text-ink">Delete this course</p>
          <p className="text-sm text-muted">Removes it from the database permanently. To hide it temporarily, untick “Published” instead.</p>
        </div>
        <form action={deleteCourse.bind(null, course.id)}>
          <ConfirmButton message={`Permanently delete “${course.title}”? This cannot be undone.`}>Delete course</ConfirmButton>
        </form>
      </Card>
    </>
  )
}
