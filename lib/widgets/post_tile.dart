import 'package:flutter/material.dart';
import 'package:fluttershare/widgets/custom_image.dart';
import 'package:fluttershare/widgets/post.dart';

class PostTile extends StatelessWidget {
  final Post post;

  PostTile(this.post);

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => showPost(context, postId: post.postId, userId: post.ownerId),
      child: cachedNetworkImage(post.mediaUrl),
    );
  }
}
