import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/dal'
import { loadCategoryNames } from '@/lib/categories'
import { createCourse } from '@/lib/actions/courses'
import { publicSiteUrl } from '@/lib/supabase/env'
import { PageHeader } from '@/components/ui'
import { CourseForm } from '../course-form'

export const metadata: Metadata = { title: 'New course' }

export default async function NewCoursePage() {
  const { supabase } = await requireAdmin()
  const categories = await loadCategoryNames(supabase)
  return (
    <>
      <Link href="/courses" className="mb-4 inline-block text-xs font-bold uppercase tracking-wider text-brand">← All courses</Link>
      <PageHeader title="New course" description="New courses are saved as drafts unless you tick “Published”." />
      <CourseForm action={createCourse} categories={categories} publicSiteUrl={publicSiteUrl} submitLabel="Create course" />
    </>
  )
}
