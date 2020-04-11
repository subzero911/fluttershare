const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.onCreateFollower = functions.firestore
    .document("/followers/{userId}/userFollowers/{followerId}")
    .onCreate(async (snap, context) => {
        console.log("Follower created ", snap.id)
        const userId = context.params.userId
        const followerId = context.params.followerId

        // 1) create followed users' posts ref
        const followedUserPostsRef = admin.firestore()
            .collection('posts').doc(userId).collection('userPosts')
        // 2) create the following user's timeline ref
        const timelinePostsRef = admin.firestore()
            .collection('timeline').doc(followerId).collection('timelinePosts')
        // 3) get followed users posts
        const querySnapshot = await followedUserPostsRef.get()
        // 4) add each user post to following user's timeline
        querySnapshot.forEach(doc => {
            if (doc.exists) {
                const postId = doc.id
                const postData = doc.data()
                timelinePostsRef.doc(postId).set(postData)
            }
        })
    })

exports.onDeleteFollower = functions.firestore
    .document("/followers/{userId}/userFollowers/{followerId}")
    .onDelete(async (snap, context) => {
        console.log("Follower deleted ", snap.id)
        const userId = context.params.userId
        const followerId = context.params.followerId

        const timelinePostsRef = admin.firestore()
            .collection('timeline').doc(followerId).collection('timelinePosts')
            .where("ownerId", "==", userId)

        const querySnapshot = await timelinePostsRef.get()
        querySnapshot.forEach(doc => {
            if (doc.exists)
                doc.ref.delete()
        })
    })

// when a post is created, add it to timeline of each follower (of post owner)
exports.onCreatePost = functions.firestore
    .document("/posts/{userId}/userPosts/{postId}")
    .onCreate(async (snap, context) => {
        const postCreated = snap.data()
        const userId = context.params.userId
        const postId = context.params.postId

        // get all the followers of the user who made the post
        const userFollowersRef = admin.firestore()
            .collection('followers').doc(userId)
            .collection('userFollowers')
        
        var querySnapshot = await userFollowersRef.get()
        // add the new post to each follower's timeline
        querySnapshot.forEach((doc) => {
            const followerId = doc.id

            admin.firestore()
                .collection('timeline')
                .doc(followerId)
                .collection('timelinePosts')
                .doc(postId)
                .set(postCreated)
        })
    })

exports.onUpdatePost = functions.firestore
    .document("/posts/{userId}/userPosts/{postId}")
    .onUpdate(async (change, context) => {
        const postUpdated = change.after.data();
        const userId = context.params.userId
        const postId = context.params.postId

        const userFollowersRef = admin.firestore()
            .collection('followers').doc(userId)
            .collection('userFollowers')
        var querySnapshot = await userFollowersRef.get()
        // update each post in the each followers timeline
        querySnapshot.forEach((doc) => {
            const followerId = doc.id

            admin.firestore()
                .collection('timeline')
                .doc(followerId)
                .collection('timelinePosts')
                .doc(postId)
                .get().then((doc) => {
                    if (doc.exists) {
                        doc.ref.update(postUpdated)
                    }
                })
        })
    })

exports.onDeletePost = functions.firestore
    .document("/posts/{userId}/userPosts/{postId}")
    .onDelete(async (snap, context) => {
        const userId = context.params.userId
        const postId = context.params.postId
        const userFollowersRef = admin.firestore()
            .collection('followers').doc(userId)
            .collection('userFollowers')
        var querySnapshot = await userFollowersRef.get()
        // delete each post in the each followers timeline
        querySnapshot.forEach((doc) => {
            const followerId = doc.id

            admin.firestore()
                .collection('timeline')
                .doc(followerId)
                .collection('timelinePosts')
                .doc(postId)
                .get().then((doc) => {
                    if (doc.exists) {
                        doc.ref.delete()
                    }
                })
        })

    })

exports.onCreateActivityFeedItem = functions.firestore
    .document("/feed/{userId}/feedItems/{activityFeedItem}")
    .onCreate(async (snapshot, context) => {
        console.log('Activity feed item created', snapshot.data())
        // get the user connected to the feed
        const userId = context.params.userId

        const userRef = admin.firestore().doc(`users/${userId}`)
        const doc = await userRef.get()

        // once we have user check if they have a notification token
        const androidNotificationToken = doc.data().androidNotificationToken;
        const createdActivityFeedItem = snapshot.data()
        if (androidNotificationToken) {
            sendNotification(androidNotificationToken, createdActivityFeedItem)
        } else {
            console.log ("No token for user; cannot send the notification")
        }

        function sendNotification (androidNotificationToken, activityFeedItem) {
            let body;
            // switch body value based on notification type 
            switch (activityFeedItem.type) {
                case "comment":
                    body = `${activityFeedItem.username} replied: ${activityFeedItem.commentData}`
                    break;
                case "like":
                    body = `${activityFeedItem.username} liked your post`
                    break;
                case "follow":
                    body = `${activityFeedItem.username} started following you`
                    break;            
                default:
                    break;
            }

            // create message for push notification
            const message = {
                notification: { body },
                token: androidNotificationToken,
                data: { recipient: userId }
            };

            // send message with admin.messaging()
            admin.messaging().send(message)
                .then(response => {
                    // response is a message ID string
                    console.log("Successfully send message", response)
                })
                .catch(error => {
                    console.log("Error sending message", error)
                })
        }

    })