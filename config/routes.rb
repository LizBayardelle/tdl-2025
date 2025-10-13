Rails.application.routes.draw do
  devise_for :users

  root "home#index"
  get "dashboard", to: "home#dashboard"
  get "search", to: "search#index"

  resources :nodes, only: [:index, :show, :create, :update, :destroy]
  resources :sources, only: [:index, :show, :create, :update, :destroy]
  resources :people, only: [:index, :show, :create, :update, :destroy]
  resources :edges, only: [:index, :show, :create, :update, :destroy]
  resources :notes, only: [:index, :show, :create, :update, :destroy]
  resources :tags, only: [:index, :show, :create, :update, :destroy]
  resources :pathways, only: [:index, :show, :create, :update, :destroy]

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Render dynamic PWA files from app/views/pwa/*
  get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker
  get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
end
