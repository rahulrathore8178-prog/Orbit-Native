import axios from 'axios'
import { API_URL } from '@/lib/utils'
import { getAuthHeaders } from '../feed/postUtils'

/** Sends a post to one contact as a chat message (text empty, sharedPostId set). */
export async function sharePostToContact(contactId: string, postId: string) {
  const res = await axios.post(
    `${API_URL}/api/chat/${contactId}`,
    { text: '', sharedPostId: postId },
    { withCredentials: true, headers: await getAuthHeaders() }
  )
  return res.data?.message
}