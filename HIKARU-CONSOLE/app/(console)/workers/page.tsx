// このページは /employees へ移行しました
import { redirect } from 'next/navigation'

export default function WorkersRedirectPage() {
  redirect('/employees')
}
