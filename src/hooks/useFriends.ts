import { useState, useEffect, useCallback, useRef } from 'react'
import type { User } from 'firebase/auth'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import {
  db,
  getUserByEmail,
  getUserProfile,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  deleteFriendRequest,
  getFriendShelf,
} from '../firebase'
import type { FriendRequest, UserProfile, FriendShelf } from '../types'

export function useFriends(user: User | null) {
  const [incoming, setIncoming] = useState<FriendRequest[]>([])
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([])
  const [friends, setFriends] = useState<UserProfile[]>([])

  const incomingRef = useRef<FriendRequest[]>([])
  const outgoingRef = useRef<FriendRequest[]>([])

  const refresh = useCallback(async (uid: string) => {
    const allIn = incomingRef.current
    const allOut = outgoingRef.current

    const pendingIn = allIn.filter((r) => r.status === 'pending')
    const pendingOut = allOut.filter((r) => r.status === 'pending')
    const accepted = [...allIn.filter((r) => r.status === 'accepted'), ...allOut.filter((r) => r.status === 'accepted')]

    const [inWithProfiles, outWithProfiles, friendProfiles] = await Promise.all([
      Promise.all(pendingIn.map(async (r) => ({ ...r, profile: (await getUserProfile(r.fromUid)) ?? undefined }))),
      Promise.all(pendingOut.map(async (r) => ({ ...r, profile: (await getUserProfile(r.toUid)) ?? undefined }))),
      Promise.all(accepted.map((r) => getUserProfile(r.fromUid === uid ? r.toUid : r.fromUid))),
    ])

    setIncoming(inWithProfiles)
    setOutgoing(outWithProfiles)
    setFriends(friendProfiles.filter((p): p is UserProfile => p !== null))
  }, [])

  useEffect(() => {
    if (!user) return
    const uid = user.uid

    const unsub1 = onSnapshot(query(collection(db, 'friendRequests'), where('toUid', '==', uid)), (snap) => {
      incomingRef.current = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FriendRequest, 'id'>) }))
      refresh(uid)
    })

    const unsub2 = onSnapshot(query(collection(db, 'friendRequests'), where('fromUid', '==', uid)), (snap) => {
      outgoingRef.current = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FriendRequest, 'id'>) }))
      refresh(uid)
    })

    return () => {
      unsub1()
      unsub2()
    }
  }, [user, refresh])

  const searchUser = useCallback((email: string) => getUserByEmail(email), [])

  const sendRequest = useCallback(
    (toUid: string) => {
      if (user) return sendFriendRequest(user.uid, toUid)
    },
    [user],
  )

  const acceptRequest = useCallback((requestId: string) => acceptFriendRequest(requestId), [])

  const rejectRequest = useCallback((requestId: string) => rejectFriendRequest(requestId), [])

  const removeRequest = useCallback((friendUid: string) => {
    const req = [...incomingRef.current, ...outgoingRef.current].find(
      (r) => r.status === 'accepted' && (r.fromUid === friendUid || r.toUid === friendUid),
    )
    if (req) return deleteFriendRequest(req.id)
  }, [])

  // 친구 책장은 서버가 공개 범위만 골라 준다 (규칙은 남의 문서 직접 읽기를 막아둠)
  const loadFriendBooks = useCallback((uid: string): Promise<FriendShelf> => getFriendShelf(uid), [])

  return {
    friends,
    incoming,
    outgoing,
    searchUser,
    sendRequest,
    acceptRequest,
    rejectRequest,
    removeRequest,
    loadFriendBooks,
  }
}
