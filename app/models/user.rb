class User < ApplicationRecord
  # Include default devise modules. Others available are:
  # :confirmable, :lockable, :timeoutable, :trackable and :omniauthable
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable

  has_many :nodes, dependent: :destroy
  has_many :sources, dependent: :destroy
  has_many :people, dependent: :destroy
  has_many :edges, dependent: :destroy
  has_many :notes, dependent: :destroy
  has_many :tags, dependent: :destroy
  has_many :pathways, dependent: :destroy
end
