class User < ApplicationRecord
  # Include default devise modules. Others available are:
  # :confirmable, :lockable, :timeoutable, :trackable and :omniauthable
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable

  has_many :concepts, dependent: :destroy
  has_many :connections, dependent: :destroy
  has_many :sources, dependent: :destroy
  has_many :people, dependent: :destroy
  has_many :notes, dependent: :destroy
  has_many :tags, dependent: :destroy
  has_many :highlight_colors, dependent: :destroy
  has_many :highlights, dependent: :destroy
end
