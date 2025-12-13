class UpdateSourceKinds < ActiveRecord::Migration[7.2]
  def up
    # Map old kinds to new kinds
    Source.where(kind: ['manual', 'textbook']).update_all(kind: 'book')
    Source.where(kind: ['rct', 'meta_analysis', 'guideline']).update_all(kind: 'article')
    Source.where(kind: 'video_demo').update_all(kind: 'video')
    Source.where(kind: 'chapter').update_all(kind: 'book_chapter')
    # article stays as article
  end

  def down
    # Reverse migration - convert back to old kinds (simplified)
    Source.where(kind: 'book').update_all(kind: 'textbook')
    Source.where(kind: 'video').update_all(kind: 'video_demo')
    Source.where(kind: 'book_chapter').update_all(kind: 'chapter')
    # article stays as article
  end
end
