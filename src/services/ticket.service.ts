import {TicketDb} from '../models/ticket';
import {EventDb} from '../models/event';
import {BadRequestError,NotFoundError} from '../interfaces';
import {
  CreateTicketRequest,
  Ticket,
  UpdateTicketRequest,
  AllTicketsResponse,
  AllTicketsRequest, TicketDetailsRequest, PurchaseFreeTicketRequest, DeleteTicketRequest, EventType
} from '../interfaces/ticket/ticket';
import { TransactionDb } from '../models/transaction';
import { AssetDb } from '../models/asset';
import { ClerkType, TransactionStatus, TransactionType } from '../interfaces/wallet/transaction';
import { PurchasedTicketDb } from '../models/purchased.ticket';

export async function createTicket(body:CreateTicketRequest):Promise<Ticket>{

  const {user,name,event,description,price,type,total,image} = body

  const linkedEvent = await EventDb.findOne({_id:event,creator:user})
  if(!linkedEvent){
    throw new NotFoundError('Unauthorised')
  }


  const ticket = await  TicketDb.create({
    name,
    event,
    image,
    description,
    price,
    type,
    total,
  })
  return ticket as unknown as Ticket

}

export async function editTicketDetails(body:UpdateTicketRequest):Promise<Ticket>{
  const {user,name,event,description,price,type,total,ticket,image} = body

  const linkedEvent = await EventDb.findOne({_id:event,creator:user})
  if(!linkedEvent){
    throw new NotFoundError('Not found')
  }


  await TicketDb.updateOne({id:ticket},{
    name,
    image,
    event,
    description,
    price,
    type,
    total,
  })

  const editedTicket = await TicketDb.findById<Ticket>(ticket)
  return editedTicket!

}

export async function getAllTickets(body:AllTicketsRequest):Promise<AllTicketsResponse>{
  let allTickets

  const {event,page,size,eventType} = body
  const totalTickets = await TicketDb.find<Ticket>({event:event}).countDocuments()

  const totalPages = Math.ceil(totalTickets/size)
  if(eventType){
    allTickets = await TicketDb.find<Ticket>({event: event,type:eventType})
    if(!allTickets){
      throw new NotFoundError('No ticket fitting this filter')
    }

  }

  allTickets = await TicketDb.find<Ticket>({event:event}).skip((page - 1) * size).limit(size)
  if(!allTickets){
    throw  new NotFoundError('No tickets available')
  }

 return{
    allTickets:allTickets,
    pagination:{
      page:page,
      size:size,
      totalCount:totalPages,
      lastPage: totalPages,
    },
 }

}

export async function getTicketDetails(body:TicketDetailsRequest):Promise<Ticket>{
  const {ticket,event} = body

  const Ticket = await TicketDb.findOne<Ticket>({_id:ticket,event:event})
  if(!Ticket){
    throw new NotFoundError('Ticket does not exist')
  }

  return Ticket!

}

export async function  deleteTicket(body:DeleteTicketRequest):Promise<void>{
  const {ticket,event,user} = body

  const hasBeenBought = await PurchasedTicketDb.findOne({ticket})
  if(hasBeenBought){
    throw new BadRequestError('Ticket cannot be deleted')
  }

  const linkedEvent = await EventDb.findById(event)
  if(linkedEvent?.creator !== user){
    throw new  BadRequestError('Unauthorised')

  }

  await TicketDb.findOneAndDelete({_id:ticket,event:event})

}


export async function purchaseTicket(body:PurchaseFreeTicketRequest):Promise<void>{
  const {user,event,ticket,email,metadata} = body
  const asset = await AssetDb.findOne({user:user})
  if(!asset){
    throw new NotFoundError('User has not assets')
  }

  const linkedTicket = await TicketDb.findById<Ticket>(ticket)
  // I tried to access the event type after populating with {linkedTicket.event.type}
  // but typescript kept throwing an error
  const linkedEvent = await EventDb.findById(event)
  if(linkedEvent!.type === EventType.FREE){
    const transaction = await TransactionDb.create({
      user:user,
      asset:asset?.id,
      symbol:'NGN',
      status: TransactionStatus.SUCCESSFUL,
      amount:0.00,
      fee:0.00,
      totalAmount:0.00,
      clerkType:ClerkType.DEBIT,
      type: TransactionType.PURCHASE,
      reason: ticket,
      description:'Ticket Purchase',
      metadata: metadata
    })
    linkedTicket!.available = +linkedTicket!.available - 1
    await linkedTicket!.save()

    await PurchasedTicketDb.create({
      ticket,
      purchasedAt:Date.now(),
      buyer:user,
      email:email,
      metadata:metadata,
      transaction: transaction.id,
      used:false

    })


  }


}
